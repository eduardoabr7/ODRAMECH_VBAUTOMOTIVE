import { Logger } from '@nestjs/common';
import { DAY_MS, Invoice, Plan, Subscription } from '../domain/model';
import { InvoiceBuilder } from '../domain/invoice.builder';
import { InvoiceRepository, PlanRepository, SubscriptionRepository } from '../repositories/repositories';
import { SubscriptionEventPublisher } from '../events/subscription-events';

/**
 * COMMAND — cada transição automática de uma assinatura é um objeto executável.
 * O agendador decide QUAL comando aplicar (planner) e a fila os executa.
 */
export interface LifecycleCommand {
  readonly label: string;
  execute(): Promise<void>;
}

export interface LifecycleDeps {
  subs: SubscriptionRepository;
  invoices: InvoiceRepository;
  plans: PlanRepository;
  events: SubscriptionEventPublisher;
  graceDays: number;
}

const sameInstant = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) < DAY_MS;

/** Gera a fatura do próximo período (renovação). */
export class CreateRenewalInvoiceCommand implements LifecycleCommand {
  readonly label: string;
  constructor(private readonly d: LifecycleDeps, private readonly sub: Subscription, private readonly plan: Plan) {
    this.label = `renovação ${sub.enterpriseId}`;
  }
  async execute() {
    const invoice = await this.d.invoices.create(
      new InvoiceBuilder().forSubscription(this.sub).ofPlan(this.plan)
        .startingAt(this.sub.currentPeriodEnd).dueInDays(0).payWith(this.sub.paymentMethod).build(),
    );
    await this.d.events.publish({
      type: 'invoice.created', subscriptionId: this.sub.id, enterpriseId: this.sub.enterpriseId, status: this.sub.status,
      data: { invoiceId: invoice.id, amountCents: invoice.amountCents, dueDate: invoice.dueDate },
    });
  }
}

/** Período acabou e a próxima fatura está paga → avança o período. */
export class RollPeriodCommand implements LifecycleCommand {
  readonly label: string;
  constructor(private readonly d: LifecycleDeps, private readonly sub: Subscription, private readonly paid: Invoice) {
    this.label = `avanço de período ${sub.enterpriseId}`;
  }
  async execute() {
    // a fatura paga pode ser de outro plano (troca agendada para a virada do período)
    const plan = await this.d.plans.findByCode(this.paid.planCode);
    const updated = await this.d.subs.update(this.sub.id, {
      status: 'ACTIVE', currentPeriodStart: this.paid.periodStart, currentPeriodEnd: this.paid.periodEnd,
      ...(plan && { planId: plan.id }),
    });
    await this.d.events.publish({
      type: this.sub.status === 'TRIALING' ? 'subscription.activated' : 'subscription.renewed',
      subscriptionId: updated.id, enterpriseId: updated.enterpriseId, status: updated.status,
      data: { periodEnd: updated.currentPeriodEnd },
    });
  }
}

/** Período acabou sem pagamento → inadimplente (com tolerância). */
export class MarkPastDueCommand implements LifecycleCommand {
  readonly label: string;
  constructor(private readonly d: LifecycleDeps, private readonly sub: Subscription, private readonly plan: Plan, private readonly hasOpen: boolean) {
    this.label = `inadimplência ${sub.enterpriseId}`;
  }
  async execute() {
    if (!this.hasOpen) await new CreateRenewalInvoiceCommand(this.d, this.sub, this.plan).execute();
    const updated = await this.d.subs.update(this.sub.id, { status: 'PAST_DUE' });
    await this.d.events.publish({
      type: 'subscription.past_due', subscriptionId: updated.id, enterpriseId: updated.enterpriseId, status: 'PAST_DUE',
      data: { graceUntil: new Date(updated.currentPeriodEnd.getTime() + this.d.graceDays * DAY_MS) },
    });
  }
}

/** Tolerância esgotada → expira. */
export class ExpireCommand implements LifecycleCommand {
  readonly label: string;
  constructor(private readonly d: LifecycleDeps, private readonly sub: Subscription) {
    this.label = `expiração ${sub.enterpriseId}`;
  }
  async execute() {
    const updated = await this.d.subs.update(this.sub.id, { status: 'EXPIRED' });
    await this.d.events.publish({ type: 'subscription.expired', subscriptionId: updated.id, enterpriseId: updated.enterpriseId, status: 'EXPIRED' });
  }
}

/** Cancelamento agendado chegou ao fim do período. */
export class FinalizeCancellationCommand implements LifecycleCommand {
  readonly label: string;
  constructor(private readonly d: LifecycleDeps, private readonly sub: Subscription, private readonly now: Date) {
    this.label = `cancelamento ${sub.enterpriseId}`;
  }
  async execute() {
    const open = await this.d.invoices.findOpen(this.sub.id);
    if (open) await this.d.invoices.update(open.id, { status: 'VOID' });
    const updated = await this.d.subs.update(this.sub.id, { status: 'CANCELED', canceledAt: this.now });
    await this.d.events.publish({ type: 'subscription.canceled', subscriptionId: updated.id, enterpriseId: updated.enterpriseId, status: 'CANCELED' });
  }
}

/**
 * Decide o próximo comando para uma assinatura (ou nenhum).
 * Toda a regra de ciclo de vida está aqui, em um só lugar, testável.
 */
export async function planNextCommand(d: LifecycleDeps, sub: Subscription, now: Date, renewalLeadDays: number): Promise<LifecycleCommand | null> {
  if (sub.status === 'EXPIRED') return null;
  if (sub.status === 'CANCELED') return null;

  const plan = await d.plans.findById(sub.planId);
  if (!plan) return null;

  const invoices = await d.invoices.listBySubscription(sub.id, 12);
  const nextPaid = invoices.find(i => i.status === 'PAID' && sameInstant(i.periodStart, sub.currentPeriodEnd));
  const nextOpen = invoices.find(i => i.status === 'OPEN');
  const periodOver = now >= sub.currentPeriodEnd;

  if (sub.cancelAtPeriodEnd && periodOver) return new FinalizeCancellationCommand(d, sub, now);

  if (periodOver) {
    if (nextPaid) return new RollPeriodCommand(d, sub, nextPaid);
    if (sub.status === 'PAST_DUE') {
      const graceEnd = new Date(sub.currentPeriodEnd.getTime() + d.graceDays * DAY_MS);
      return now >= graceEnd ? new ExpireCommand(d, sub) : null;
    }
    return new MarkPastDueCommand(d, sub, plan, !!nextOpen);
  }

  const renewalWindow = sub.currentPeriodEnd.getTime() - renewalLeadDays * DAY_MS;
  const needsInvoice = !sub.cancelAtPeriodEnd && !nextPaid && !nextOpen && now.getTime() >= renewalWindow;
  // durante o teste só cobramos se a empresa já escolheu a forma de pagamento
  if (needsInvoice && (sub.status !== 'TRIALING' || sub.paymentMethod)) return new CreateRenewalInvoiceCommand(d, sub, plan);

  return null;
}

/** Fila simples que executa comandos em sequência, isolando falhas. */
export class BillingJobQueue {
  private readonly logger = new Logger('BillingQueue');

  async run(commands: LifecycleCommand[]): Promise<{ ok: number; failed: number }> {
    let ok = 0;
    let failed = 0;
    for (const cmd of commands) {
      try {
        await cmd.execute();
        ok++;
      } catch (err) {
        failed++;
        this.logger.error(`Falhou: ${cmd.label} — ${(err as Error).message}`);
      }
    }
    return { ok, failed };
  }
}
