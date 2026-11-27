import {
  BadRequestException, ConflictException, ForbiddenException, Logger, NotFoundException, ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { cycleFor } from '../domain/billing-cycle.strategy';
import { decideAccess } from '../domain/access-policy';
import { InvoiceBuilder } from '../domain/invoice.builder';
import { complimentaryActive, entitlementsOf, Invoice, PaymentMethod, Plan, Subscription } from '../domain/model';
import { SubscriptionFactory } from '../domain/subscription.factory';
import { InvalidWebhookSignature, PaymentGateway, WebhookParser } from '../payments/payment-provider';
import { paymentStrategyFor, PAYMENT_METHODS, PayRequest } from '../payments/payment-method.strategy';
import { InvoiceRepository, PlanRepository, SubscriptionRepository } from '../repositories/repositories';
import { SubscriptionEventPublisher } from '../events/subscription-events';
import { BillingJobQueue, LifecycleDeps, planNextCommand } from './lifecycle.commands';
import { Clock } from './clock';

export interface SubscriptionSettings {
  trialDays: number;
  graceDays: number;
  renewalLeadDays: number;
  defaultPlanCode: string;
  /** falso = nenhum pagamento é processado (sandbox em produção) */
  paymentsEnabled: boolean;
}

/**
 * Casos de uso do Gerenciamento de Assinaturas.
 * Depende só de abstrações (repositórios, gateway, relógio, publicador de eventos) —
 * por isso o mesmo código roda em produção (Prisma + gateway real) e nos testes (memória + sandbox).
 */
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly queue = new BillingJobQueue();

  constructor(
    private readonly plans: PlanRepository,
    private readonly subs: SubscriptionRepository,
    private readonly invoices: InvoiceRepository,
    private readonly gateway: PaymentGateway,
    private readonly webhookParser: WebhookParser,
    private readonly events: SubscriptionEventPublisher,
    private readonly clock: Clock,
    private readonly settings: SubscriptionSettings,
  ) {}

  // ═══ Consultas ══════════════════════════════════════════
  async listPlans() {
    const plans = await this.plans.listActive();
    const monthly = plans.find(p => p.interval === 'MONTHLY');
    return plans.map(p => {
      const cycle = cycleFor(p.interval);
      const monthlyEquivalentCents = Math.round(p.priceCents / cycle.months);
      const savingsPercent = monthly && p.interval !== 'MONTHLY'
        ? Math.round((1 - monthlyEquivalentCents / monthly.priceCents) * 100)
        : 0;
      return { ...p, intervalLabel: cycle.label, monthlyEquivalentCents, savingsPercent };
    });
  }

  /** Visão completa da assinatura de uma empresa. Cria o teste grátis no primeiro acesso. */
  async overview(enterpriseId: number, enterpriseName?: string | null) {
    const sub = await this.getOrStartTrial(enterpriseId, enterpriseName ?? null);
    const [plan, invoices, plans] = await Promise.all([
      this.plans.findById(sub.planId),
      this.invoices.listBySubscription(sub.id, 12),
      this.listPlans(),
    ]);
    return {
      // a anotação interna do administrador nunca vai para a oficina
      subscription: { ...sub, adminNote: undefined },
      plan,
      access: decideAccess(sub, this.settings.graceDays, this.clock.now()),
      openInvoice: invoices.find(i => i.status === 'OPEN') ?? null,
      invoices,
      plans,
      paymentMethods: PAYMENT_METHODS,
    };
  }

  /** Só a decisão de acesso — chamada frequente do backend da oficina. */
  async access(enterpriseId: number) {
    const sub = await this.getOrStartTrial(enterpriseId, null);
    const plan = await this.plans.findById(sub.planId);
    return {
      status: sub.status,
      ...decideAccess(sub, this.settings.graceDays, this.clock.now()),
      plan: plan ? entitlementsOf(plan) : null,
    };
  }

  // ═══ Comandos do cliente ════════════════════════════════
  // Troca de plano — o plano novo SÓ vale depois que a fatura é paga (inclusive no teste grátis;
  // antes, escolher um plano no teste liberava ele na hora, sem pagar):
  //  - no teste grátis a fatura começa agora: pagou, vira ATIVA no plano escolhido
  //  - upgrade começa agora, com desconto proporcional do que sobrou do período
  //  - downgrade (ou mesmo nível) só na renovação
  //  - inadimplente, expirada ou cancelada começa agora
  async selectPlan(enterpriseId: number, planCode: string, method: PaymentMethod) {
    const plan = await this.plans.findByCode(planCode);
    if (!plan || !plan.active) throw new NotFoundException('Plano não encontrado.');
    paymentStrategyFor(method); // valida a forma de pagamento

    let sub = await this.getOrStartTrial(enterpriseId, null);
    const now = this.clock.now();
    this.assertSelfServiceAllowed(sub, now);
    const current = await this.plans.findById(sub.planId);

    // fatura em aberto de outro plano/forma é anulada para gerar a correta
    const open = await this.invoices.findOpen(sub.id);
    if (open) await this.invoices.update(open.id, { status: 'VOID' });

    const paidAndCurrent = sub.status === 'ACTIVE' && sub.currentPeriodEnd > now;
    const isUpgrade = !!current && plan.tier > current.tier;

    sub = await this.subs.update(sub.id, { paymentMethod: method, cancelAtPeriodEnd: false });

    let start = now;
    let creditCents = 0;
    if (paidAndCurrent && !isUpgrade) start = sub.currentPeriodEnd;
    else if (paidAndCurrent && isUpgrade && current) creditCents = this.unusedCredit(sub, current, now);

    const invoice = await this.invoices.create(
      new InvoiceBuilder().forSubscription(sub).ofPlan(plan).startingAt(start).dueInDays(0)
        .withDiscount(creditCents).payWith(method).build(),
    );

    await this.events.publish({
      type: 'subscription.plan_selected', subscriptionId: sub.id, enterpriseId, status: sub.status,
      data: { planCode: plan.code, previousPlanCode: current?.code, method, invoiceId: invoice.id, creditCents },
    });
    return this.overview(enterpriseId);
  }

  // crédito do upgrade: proporcional ao que falta do período pago
  private unusedCredit(sub: Subscription, plan: Plan, now: Date): number {
    const total = sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime();
    const left = sub.currentPeriodEnd.getTime() - now.getTime();
    if (total <= 0 || left <= 0) return 0;
    return Math.floor(plan.priceCents * Math.min(1, left / total));
  }

  async payInvoice(enterpriseId: number, invoiceId: string, method: PaymentMethod, req: PayRequest) {
    this.assertPaymentsEnabled();
    const { sub, invoice } = await this.ownedInvoice(enterpriseId, invoiceId);
    this.assertSelfServiceAllowed(sub, this.clock.now());
    if (invoice.status !== 'OPEN') throw new ConflictException('Esta fatura não está em aberto.');

    const result = await paymentStrategyFor(method).pay(invoice, this.gateway, req);
    let updated = await this.invoices.update(invoice.id, { method, gatewayRef: result.gatewayRef, instructions: result.instructions });

    if (result.status === 'failed') {
      await this.events.publish({ type: 'invoice.payment_failed', subscriptionId: sub.id, enterpriseId, status: sub.status, data: { reason: result.failureReason } });
      throw new BadRequestException(result.failureReason ?? 'Pagamento recusado.');
    }
    // mesmo com "aprovado" na resposta, quem libera é a consulta ao provedor (valor e moeda conferidos)
    if (result.status === 'paid') {
      const outcome = await this.confirmWithProvider(updated);
      if (outcome.paid) updated = outcome.invoice;
    }

    return { invoice: updated, ...(await this.overview(enterpriseId)) };
  }

  async cancel(enterpriseId: number) {
    const sub = await this.mustFind(enterpriseId);
    if (sub.status === 'CANCELED' || sub.status === 'EXPIRED') throw new ConflictException('Assinatura já encerrada.');
    const open = await this.invoices.findOpen(sub.id);
    if (open) await this.invoices.update(open.id, { status: 'VOID' });
    await this.subs.update(sub.id, { cancelAtPeriodEnd: true });
    await this.events.publish({ type: 'subscription.cancel_scheduled', subscriptionId: sub.id, enterpriseId, status: sub.status, data: { endsAt: sub.currentPeriodEnd } });
    return this.overview(enterpriseId);
  }

  async resume(enterpriseId: number) {
    const sub = await this.mustFind(enterpriseId);
    if (!sub.cancelAtPeriodEnd) return this.overview(enterpriseId);
    await this.subs.update(sub.id, { cancelAtPeriodEnd: false });
    await this.events.publish({ type: 'subscription.resumed', subscriptionId: sub.id, enterpriseId, status: sub.status });
    return this.overview(enterpriseId);
  }

  // ═══ Gateway ════════════════════════════════════════════
  /**
   * Webhook do provedor. Três barreiras antes de liberar qualquer coisa:
   *  1. assinatura do provedor sobre o corpo cru (senão 401);
   *  2. a cobrança precisa ser nossa (gatewayRef de uma fatura existente);
   *  3. a situação é CONSULTADA no provedor — o corpo do webhook nunca é a fonte da verdade —
   *     e valor + moeda têm que bater com a fatura.
   */
  async handleWebhook(headers: Record<string, unknown>, body: unknown, rawBody?: Buffer) {
    if (!this.settings.paymentsEnabled) throw new ForbiddenException('Pagamentos desativados neste ambiente.');

    let event;
    try {
      event = this.webhookParser.parse(headers, body, rawBody);
    } catch (err) {
      if (err instanceof InvalidWebhookSignature) {
        this.logger.warn('Webhook com assinatura inválida recusado.');
        throw new UnauthorizedException('Assinatura inválida.');
      }
      throw err;
    }
    if (!event) return { ignored: true };

    const invoice = await this.invoices.findByGatewayRef(event.gatewayRef);
    if (!invoice) throw new NotFoundException('Cobrança desconhecida.');
    if (invoice.status === 'PAID') return { alreadyPaid: true }; // idempotente
    if (invoice.status === 'VOID') return { ignored: true };

    if (event.type === 'payment.confirmed') {
      const outcome = await this.confirmWithProvider(invoice);
      return outcome.paid ? { paid: true } : { ignored: true, reason: outcome.reason };
    }
    const sub = await this.subs.findById(invoice.subscriptionId);
    if (sub) await this.events.publish({ type: 'invoice.payment_failed', subscriptionId: sub.id, enterpriseId: sub.enterpriseId, status: sub.status });
    return { failed: true };
  }

  /** Sandbox (só fora de produção): confirma a fatura como se o provedor tivesse recebido. */
  async simulatePayment(enterpriseId: number, invoiceId: string) {
    const { invoice } = await this.ownedInvoice(enterpriseId, invoiceId);
    if (!invoice.gatewayRef) throw new ConflictException('Gere a cobrança (Pix/Boleto) antes de simular o pagamento.');
    if (invoice.status === 'OPEN') await this.confirmWithProvider(invoice);
    return this.overview(enterpriseId);
  }

  /** consulta o provedor e só marca como paga se ele confirmar o valor exato da fatura */
  private async confirmWithProvider(invoice: Invoice): Promise<{ paid: true; invoice: Invoice } | { paid: false; reason: string }> {
    if (!invoice.gatewayRef) return { paid: false, reason: 'sem cobrança' };
    const charge = await this.gateway.fetchCharge(invoice.gatewayRef);
    if (!charge || charge.status !== 'paid') return { paid: false, reason: 'provedor não confirma o pagamento' };

    if (charge.amountCents !== invoice.amountCents || charge.currency !== 'BRL') {
      const sub = await this.subs.findById(invoice.subscriptionId);
      this.logger.error(`Valor divergente na fatura ${invoice.id}: pago ${charge.amountCents} ${charge.currency}, esperado ${invoice.amountCents} BRL`);
      if (sub) {
        await this.events.publish({
          type: 'invoice.amount_mismatch', subscriptionId: sub.id, enterpriseId: sub.enterpriseId, status: sub.status,
          data: { invoiceId: invoice.id, expectedCents: invoice.amountCents, paidCents: charge.amountCents, currency: charge.currency },
        });
      }
      return { paid: false, reason: 'valor divergente — fatura enviada para revisão' };
    }
    return { paid: true, invoice: await this.markInvoicePaid(invoice) };
  }

  private assertPaymentsEnabled() {
    if (!this.settings.paymentsEnabled) {
      throw new ServiceUnavailableException('Pagamento online ainda não disponível. Fale com o suporte para ativar sua assinatura.');
    }
  }

  /** licença cortesia ou suspensa é gerenciada só pelo administrador */
  private assertSelfServiceAllowed(sub: Subscription, now: Date) {
    if (sub.suspended) throw new ForbiddenException('Licença suspensa. Fale com o suporte.');
    if (complimentaryActive(sub, now)) throw new ConflictException('Sua licença é cortesia e é gerenciada pelo suporte.');
  }

  // ═══ Agendador ══════════════════════════════════════════
  /** Aplica as transições automáticas (renovação, inadimplência, expiração, cancelamento). */
  async processLifecycle() {
    const now = this.clock.now();
    const until = new Date(now.getTime() + this.settings.renewalLeadDays * 86_400_000);
    const candidates = await this.subs.dueForProcessing(until);
    const deps = this.deps();

    const commands = (await Promise.all(candidates.map(s => planNextCommand(deps, s, now, this.settings.renewalLeadDays))))
      .filter((c): c is NonNullable<typeof c> => !!c);

    const result = await this.queue.run(commands);
    if (commands.length) this.logger.log(`Ciclo de cobrança: ${result.ok} ok, ${result.failed} com erro`);
    return result;
  }

  async adminOverview() {
    const [subs, plans] = await Promise.all([this.subs.listAll(), this.plans.listActive()]);
    const byId = new Map(plans.map(p => [p.id, p] as const));
    const byStatus: Record<string, number> = {};
    let mrrCents = 0;
    for (const s of subs) {
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
      const plan = byId.get(s.planId);
      if (plan && s.status === 'ACTIVE') mrrCents += Math.round(plan.priceCents / cycleFor(plan.interval).months);
    }
    return { total: subs.length, byStatus, mrrCents, subscriptions: subs };
  }

  // ═══ Internos ═══════════════════════════════════════════
  private deps(): LifecycleDeps {
    return { subs: this.subs, invoices: this.invoices, plans: this.plans, events: this.events, graceDays: this.settings.graceDays };
  }

  private async getOrStartTrial(enterpriseId: number, enterpriseName: string | null): Promise<Subscription> {
    const existing = await this.subs.findByEnterprise(enterpriseId);
    if (existing) {
      if (enterpriseName && existing.enterpriseName !== enterpriseName) return this.subs.update(existing.id, { enterpriseName });
      return existing;
    }

    const plan = await this.defaultPlan();
    const sub = await this.subs.create(SubscriptionFactory.trial(enterpriseId, enterpriseName, plan, this.settings.trialDays, this.clock.now()));
    await this.events.publish({ type: 'subscription.trial_started', subscriptionId: sub.id, enterpriseId, status: sub.status, data: { trialEndsAt: sub.trialEndsAt } });
    return sub;
  }

  private async defaultPlan(): Promise<Plan> {
    const plan = (await this.plans.findByCode(this.settings.defaultPlanCode)) ?? (await this.plans.listActive())[0];
    if (!plan) throw new Error('Nenhum plano cadastrado — rode o seed do serviço de assinaturas.');
    return plan;
  }

  private async mustFind(enterpriseId: number) {
    const sub = await this.subs.findByEnterprise(enterpriseId);
    if (!sub) throw new NotFoundException('Assinatura não encontrada.');
    return sub;
  }

  private async ownedInvoice(enterpriseId: number, invoiceId: string) {
    const sub = await this.mustFind(enterpriseId);
    const invoice = await this.invoices.findById(invoiceId);
    if (!invoice || invoice.subscriptionId !== sub.id) throw new NotFoundException('Fatura não encontrada.');
    return { sub, invoice };
  }

  /**
   * Fatura paga → ativa/reativa a assinatura quando o período pago já começou.
   * Público só para o painel administrativo ("marcar como paga" — ex.: recebeu por transferência).
   */
  async markInvoicePaid(invoice: Invoice, actor?: string): Promise<Invoice> {
    const now = this.clock.now();
    const sub = await this.subs.findById(invoice.subscriptionId);
    const blocked = !!sub && (sub.status === 'EXPIRED' || sub.status === 'CANCELED');

    // estava bloqueada: o período comprado começa AGORA (não paga pelos dias em que ficou sem acesso)
    let periodStart = invoice.periodStart;
    let periodEnd = invoice.periodEnd;
    if (blocked && periodStart < now) {
      const plan = await this.plans.findByCode(invoice.planCode);
      periodStart = now;
      periodEnd = plan ? cycleFor(plan.interval).periodEnd(now) : new Date(now.getTime() + (invoice.periodEnd.getTime() - invoice.periodStart.getTime()));
    }

    const paid = await this.invoices.update(invoice.id, { status: 'PAID', paidAt: now, periodStart, periodEnd });
    if (!sub) return paid;

    await this.events.publish({
      type: actor ? 'license.invoice_marked_paid' : 'invoice.paid', actor,
      subscriptionId: sub.id, enterpriseId: sub.enterpriseId, status: sub.status, data: { invoiceId: paid.id, amountCents: paid.amountCents },
    });

    const startsNow = paid.periodStart <= now;
    const recovering = sub.status === 'PAST_DUE' || blocked;
    if (startsNow || recovering) {
      const plan = await this.plans.findByCode(paid.planCode);
      const updated = await this.subs.update(sub.id, {
        status: 'ACTIVE',
        ...(plan && { planId: plan.id }),
        currentPeriodStart: paid.periodStart,
        currentPeriodEnd: paid.periodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        // passou a pagar: deixa de ser cortesia
        complimentary: false,
        complimentaryUntil: null,
      });
      await this.events.publish({ type: 'subscription.activated', subscriptionId: updated.id, enterpriseId: updated.enterpriseId, status: 'ACTIVE', data: { periodEnd: updated.currentPeriodEnd } });
    }
    // se o período pago ainda não começou (downgrade/renovação adiantada), o agendador avança na virada
    return paid;
  }
}
