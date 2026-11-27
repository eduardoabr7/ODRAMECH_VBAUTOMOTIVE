import { FixedClock } from './clock';
import { SubscriptionService } from './subscription.service';
import { SubscriptionEventPublisher, SubscriptionChanged } from '../events/subscription-events';
import { SandboxProviderFactory } from '../payments/sandbox/sandbox.provider';
import {
  InMemoryInvoiceRepository, InMemoryPlanRepository, InMemorySubscriptionRepository,
} from '../repositories/in-memory.repositories';
import { Plan } from '../domain/model';
import { addMonthsClamped, cycleFor } from '../domain/billing-cycle.strategy';
import { decideAccess } from '../domain/access-policy';

const PLANS: Plan[] = [
  { id: 1, code: 'MENSAL', name: 'Mensal', interval: 'MONTHLY', priceCents: 14990, currency: 'BRL', description: null, active: true, sortOrder: 1 },
  { id: 2, code: 'ANUAL', name: 'Anual', interval: 'YEARLY', priceCents: 143880, currency: 'BRL', description: null, active: true, sortOrder: 2 },
];

function setup(start = new Date('2026-01-10T12:00:00Z')) {
  const clock = new FixedClock(start);
  const subs = new InMemorySubscriptionRepository();
  const invoices = new InMemoryInvoiceRepository();
  const events: SubscriptionChanged[] = [];
  const publisher = new SubscriptionEventPublisher();
  publisher.attach({ onEvent: e => { events.push(e); } });
  const provider = new SandboxProviderFactory();

  const service = new SubscriptionService(
    new InMemoryPlanRepository(PLANS), subs, invoices,
    provider.createGateway(), provider.createWebhookParser(), publisher, clock,
    { trialDays: 14, graceDays: 7, renewalLeadDays: 5, defaultPlanCode: 'MENSAL' },
  );
  return { service, clock, subs, invoices, events };
}

describe('Ciclos de cobrança (Strategy)', () => {
  it('mensal soma um mês e respeita fim de mês', () => {
    expect(addMonthsClamped(new Date('2026-01-31T00:00:00Z'), 1).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(cycleFor('MONTHLY').periodEnd(new Date('2026-03-15T00:00:00Z')).toISOString()).toBe('2026-04-15T00:00:00.000Z');
  });

  it('anual soma 12 meses (inclusive 29/02)', () => {
    expect(cycleFor('YEARLY').periodEnd(new Date('2028-02-29T00:00:00Z')).toISOString()).toBe('2029-02-28T00:00:00.000Z');
  });
});

describe('SubscriptionService', () => {
  it('primeiro acesso inicia teste grátis de 14 dias', async () => {
    const { service, events } = setup();
    const o = await service.overview(1, 'Oficina do Zé');
    expect(o.subscription.status).toBe('TRIALING');
    expect(o.access.level).toBe('full');
    expect(o.subscription.currentPeriodEnd.toISOString()).toBe('2026-01-24T12:00:00.000Z');
    expect(events.map(e => e.type)).toContain('subscription.trial_started');
  });

  it('plano anual mostra desconto de 20% e equivalente mensal', async () => {
    const { service } = setup();
    const anual = (await service.listPlans()).find(p => p.code === 'ANUAL')!;
    expect(anual.monthlyEquivalentCents).toBe(11990);
    expect(anual.savingsPercent).toBe(20);
  });

  it('escolher plano no teste gera fatura começando no fim do teste', async () => {
    const { service } = setup();
    await service.overview(1);
    const o = await service.selectPlan(1, 'ANUAL', 'PIX');
    expect(o.openInvoice!.amountCents).toBe(143880);
    expect(o.openInvoice!.periodStart.toISOString()).toBe('2026-01-24T12:00:00.000Z');
    expect(o.openInvoice!.periodEnd.toISOString()).toBe('2027-01-24T12:00:00.000Z');
  });

  it('cartão aprovado no teste: segue em teste e vira ATIVA na virada do período', async () => {
    const { service, clock } = setup();
    await service.overview(1);
    const { openInvoice } = await service.selectPlan(1, 'MENSAL', 'CARD');
    const paid = await service.payInvoice(1, openInvoice!.id, 'CARD', { cardToken: 'tok_ok' });
    expect(paid.invoice.status).toBe('PAID');
    expect(paid.subscription.status).toBe('TRIALING');

    clock.advanceDays(15);
    await service.processLifecycle();
    const after = await service.overview(1);
    expect(after.subscription.status).toBe('ACTIVE');
    expect(after.subscription.currentPeriodEnd.toISOString()).toBe('2026-02-24T12:00:00.000Z');
  });

  it('cartão recusado não altera a fatura para paga', async () => {
    const { service } = setup();
    await service.overview(1);
    const { openInvoice } = await service.selectPlan(1, 'MENSAL', 'CARD');
    await expect(service.payInvoice(1, openInvoice!.id, 'CARD', { cardToken: 'tok_recusado' })).rejects.toThrow('recusado');
    expect((await service.overview(1)).openInvoice!.status).toBe('OPEN');
  });

  it('Pix fica pendente até o webhook confirmar (e o webhook é idempotente)', async () => {
    const { service, clock } = setup();
    await service.overview(1);
    clock.advanceDays(20); // teste acabou sem pagar
    await service.processLifecycle();
    expect((await service.overview(1)).subscription.status).toBe('PAST_DUE');

    const { openInvoice } = await service.selectPlan(1, 'MENSAL', 'PIX');
    const pending = await service.payInvoice(1, openInvoice!.id, 'PIX', {});
    expect(pending.invoice.status).toBe('OPEN');
    expect(pending.invoice.instructions?.pixCode).toBeTruthy();

    const ref = pending.invoice.gatewayRef!;
    await service.handleWebhook({}, { event: 'PAYMENT_CONFIRMED', reference: ref });
    expect(await service.handleWebhook({}, { event: 'PAYMENT_CONFIRMED', reference: ref })).toEqual({ alreadyPaid: true });

    const o = await service.overview(1);
    expect(o.subscription.status).toBe('ACTIVE');
    expect(o.access.level).toBe('full');
  });

  it('sem pagamento: inadimplente com tolerância e depois expira (bloqueia)', async () => {
    const { service, clock } = setup();
    await service.overview(1);

    clock.advanceDays(15);
    await service.processLifecycle();
    let o = await service.overview(1);
    expect(o.subscription.status).toBe('PAST_DUE');
    expect(o.access.level).toBe('grace');
    expect(o.openInvoice).not.toBeNull();

    clock.advanceDays(7);
    await service.processLifecycle();
    o = await service.overview(1);
    expect(o.subscription.status).toBe('EXPIRED');
    expect(o.access.level).toBe('blocked');
  });

  it('cancelamento agendado mantém acesso até o fim do período e então encerra', async () => {
    const { service, clock } = setup();
    await service.overview(1);
    const { openInvoice } = await service.selectPlan(1, 'MENSAL', 'CARD');
    await service.payInvoice(1, openInvoice!.id, 'CARD', { cardToken: 'tok_ok' });
    clock.advanceDays(15);
    await service.processLifecycle(); // ativa

    await service.cancel(1);
    let o = await service.overview(1);
    expect(o.subscription.cancelAtPeriodEnd).toBe(true);
    expect(o.access.level).toBe('full');

    clock.advanceDays(31);
    await service.processLifecycle();
    o = await service.overview(1);
    expect(o.subscription.status).toBe('CANCELED');
    expect(o.access.level).toBe('blocked');
  });

  it('renovação: gera a fatura do próximo mês alguns dias antes do vencimento', async () => {
    const { service, clock, invoices } = setup();
    await service.overview(1);
    const { openInvoice } = await service.selectPlan(1, 'MENSAL', 'CARD');
    await service.payInvoice(1, openInvoice!.id, 'CARD', { cardToken: 'tok_ok' });
    clock.advanceDays(15);
    await service.processLifecycle(); // ativa: período 24/01 → 24/02

    clock.set(new Date('2026-02-20T12:00:00Z')); // 4 dias antes
    await service.processLifecycle();
    const open = invoices.rows.filter(i => i.status === 'OPEN');
    expect(open).toHaveLength(1);
    expect(open[0].periodStart.toISOString()).toBe('2026-02-24T12:00:00.000Z');
  });
});

describe('Política de acesso', () => {
  it('sem assinatura → acesso liberado (primeiro acesso)', () => {
    expect(decideAccess(null, 7, new Date()).level).toBe('full');
  });
});
