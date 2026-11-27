import { cycleFor } from './billing-cycle.strategy';
import { DAY_MS, NewInvoice, PaymentInstructions, PaymentMethod, Plan, Subscription } from './model';

/**
 * BUILDER — monta uma fatura passo a passo, validando no final.
 *
 *   new InvoiceBuilder()
 *     .forSubscription(sub)
 *     .ofPlan(plan)
 *     .startingAt(sub.currentPeriodEnd)   // período calculado pela Strategy do ciclo
 *     .dueInDays(0)
 *     .payWith('PIX')
 *     .build();
 */
export class InvoiceBuilder {
  private subscription?: Subscription;
  private plan?: Plan;
  private start?: Date;
  private dueDate?: Date;
  private method: PaymentMethod | null = null;
  private instructions: PaymentInstructions | null = null;
  private discountCents = 0;

  forSubscription(subscription: Subscription): this {
    this.subscription = subscription;
    return this;
  }

  ofPlan(plan: Plan): this {
    this.plan = plan;
    return this;
  }

  startingAt(start: Date): this {
    this.start = start;
    return this;
  }

  /** vencimento relativo ao início do período */
  dueInDays(days: number): this {
    if (!this.start) throw new Error('Defina o início do período antes do vencimento.');
    this.dueDate = new Date(this.start.getTime() + days * DAY_MS);
    return this;
  }

  payWith(method: PaymentMethod | null): this {
    this.method = method;
    return this;
  }

  withInstructions(instructions: PaymentInstructions | null): this {
    this.instructions = instructions;
    return this;
  }

  withDiscount(cents: number): this {
    this.discountCents = Math.max(0, Math.round(cents));
    return this;
  }

  build(): NewInvoice {
    if (!this.subscription) throw new Error('Fatura sem assinatura.');
    if (!this.plan) throw new Error('Fatura sem plano.');
    if (!this.start) throw new Error('Fatura sem início de período.');

    const periodEnd = cycleFor(this.plan.interval).periodEnd(this.start);
    const amountCents = Math.max(0, this.plan.priceCents - this.discountCents);

    return {
      subscriptionId: this.subscription.id,
      planCode: this.plan.code,
      amountCents,
      status: 'OPEN',
      periodStart: this.start,
      periodEnd,
      dueDate: this.dueDate ?? this.start,
      paidAt: null,
      method: this.method,
      gatewayRef: null,
      instructions: this.instructions,
    };
  }
}
