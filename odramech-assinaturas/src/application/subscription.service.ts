import { BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { cycleFor } from '../domain/billing-cycle.strategy';
import { decideAccess } from '../domain/access-policy';
import { InvoiceBuilder } from '../domain/invoice.builder';
import { Invoice, PaymentMethod, Plan, Subscription } from '../domain/model';
import { SubscriptionFactory } from '../domain/subscription.factory';
import { PaymentGateway, WebhookParser } from '../payments/payment-provider';
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
      subscription: sub,
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
    return { status: sub.status, ...decideAccess(sub, this.settings.graceDays, this.clock.now()) };
  }

  // ═══ Comandos do cliente ════════════════════════════════
  async selectPlan(enterpriseId: number, planCode: string, method: PaymentMethod) {
    const plan = await this.plans.findByCode(planCode);
    if (!plan || !plan.active) throw new NotFoundException('Plano não encontrado.');
    paymentStrategyFor(method); // valida a forma de pagamento

    let sub = await this.getOrStartTrial(enterpriseId, null);
    const now = this.clock.now();

    // fatura em aberto de outro plano/forma é anulada para gerar a correta
    const open = await this.invoices.findOpen(sub.id);
    if (open) await this.invoices.update(open.id, { status: 'VOID' });

    sub = await this.subs.update(sub.id, { planId: plan.id, paymentMethod: method, cancelAtPeriodEnd: false });

    // em dia → próxima fatura começa no fim do período atual; senão começa agora
    const inGoodStanding = (sub.status === 'TRIALING' || sub.status === 'ACTIVE') && sub.currentPeriodEnd > now;
    const start = inGoodStanding ? sub.currentPeriodEnd : now;

    const invoice = await this.invoices.create(
      new InvoiceBuilder().forSubscription(sub).ofPlan(plan).startingAt(start).dueInDays(0).payWith(method).build(),
    );

    await this.events.publish({
      type: 'subscription.plan_selected', subscriptionId: sub.id, enterpriseId, status: sub.status,
      data: { planCode: plan.code, method, invoiceId: invoice.id },
    });
    return this.overview(enterpriseId);
  }

  async payInvoice(enterpriseId: number, invoiceId: string, method: PaymentMethod, req: PayRequest) {
    const { sub, invoice } = await this.ownedInvoice(enterpriseId, invoiceId);
    if (invoice.status !== 'OPEN') throw new ConflictException('Esta fatura não está em aberto.');

    const result = await paymentStrategyFor(method).pay(invoice, this.gateway, req);
    let updated = await this.invoices.update(invoice.id, { method, gatewayRef: result.gatewayRef, instructions: result.instructions });

    if (result.status === 'failed') {
      await this.events.publish({ type: 'invoice.payment_failed', subscriptionId: sub.id, enterpriseId, status: sub.status, data: { reason: result.failureReason } });
      throw new BadRequestException(result.failureReason ?? 'Pagamento recusado.');
    }
    if (result.status === 'paid') updated = await this.markInvoicePaid(updated);

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
  async handleWebhook(headers: Record<string, unknown>, body: unknown) {
    const event = this.webhookParser.parse(headers, body);
    if (!event) return { ignored: true };

    const invoice = await this.invoices.findByGatewayRef(event.gatewayRef);
    if (!invoice) throw new NotFoundException('Cobrança desconhecida.');
    if (invoice.status === 'PAID') return { alreadyPaid: true }; // idempotente

    if (event.type === 'payment.confirmed') {
      await this.markInvoicePaid(invoice);
      return { paid: true };
    }
    const sub = await this.subs.findById(invoice.subscriptionId);
    if (sub) await this.events.publish({ type: 'invoice.payment_failed', subscriptionId: sub.id, enterpriseId: sub.enterpriseId, status: sub.status });
    return { failed: true };
  }

  /** Sandbox: confirma o pagamento como se o provedor tivesse chamado o webhook. */
  async simulatePayment(enterpriseId: number, invoiceId: string) {
    const { invoice } = await this.ownedInvoice(enterpriseId, invoiceId);
    if (!invoice.gatewayRef) throw new ConflictException('Gere a cobrança (Pix/Boleto) antes de simular o pagamento.');
    await this.handleWebhook({}, { event: 'PAYMENT_CONFIRMED', reference: invoice.gatewayRef });
    return this.overview(enterpriseId);
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

  /** Fatura paga → ativa/reativa a assinatura quando o período pago já começou. */
  private async markInvoicePaid(invoice: Invoice): Promise<Invoice> {
    const now = this.clock.now();
    const paid = await this.invoices.update(invoice.id, { status: 'PAID', paidAt: now });
    const sub = await this.subs.findById(invoice.subscriptionId);
    if (!sub) return paid;

    await this.events.publish({ type: 'invoice.paid', subscriptionId: sub.id, enterpriseId: sub.enterpriseId, status: sub.status, data: { invoiceId: paid.id, amountCents: paid.amountCents } });

    const startsNow = paid.periodStart <= now;
    const recovering = sub.status === 'PAST_DUE' || sub.status === 'EXPIRED' || sub.status === 'CANCELED';
    if (startsNow || recovering) {
      const updated = await this.subs.update(sub.id, {
        status: 'ACTIVE',
        currentPeriodStart: startsNow ? paid.periodStart : now,
        currentPeriodEnd: startsNow ? paid.periodEnd : paid.periodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      });
      await this.events.publish({ type: 'subscription.activated', subscriptionId: updated.id, enterpriseId: updated.enterpriseId, status: 'ACTIVE', data: { periodEnd: updated.currentPeriodEnd } });
    }
    // se o período pago ainda não começou (pagou adiantado no teste), o agendador avança na virada
    return paid;
  }
}
