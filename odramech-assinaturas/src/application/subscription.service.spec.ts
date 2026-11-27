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

const plan = (id: number, code: string, priceCents: number, tier: number, maxEstablishments: number | null, features: string[] = []): Plan =>
  ({ id, code, name: code, interval: 'MONTHLY', priceCents, currency: 'BRL', description: null, active: true, sortOrder: tier, tier, maxEstablishments, features });

const PLANS: Plan[] = [
  plan(1, 'BASIC', 22990, 1, 1),
  plan(2, 'INTERMEDIARIO', 42500, 2, 3, ['QUOTE_DOCUMENT_EDITOR']),
  plan(3, 'PRO', 79900, 3, 5, ['QUOTE_DOCUMENT_EDITOR']),
  plan(4, 'ULTRA', 239900, 4, null, ['QUOTE_DOCUMENT_EDITOR']),
];

/** assina o plano com cartão e deixa ATIVA (passa o teste) */
async function activate(service: SubscriptionService, clock: FixedClock, code: string) {
  await service.overview(1);
  const { openInvoice } = await service.selectPlan(1, code, 'CARD');
  await service.payInvoice(1, openInvoice!.id, 'CARD', { cardToken: 'tok_ok' });
  clock.advanceDays(15);
  await service.processLifecycle();
}

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
    { trialDays: 14, graceDays: 7, renewalLeadDays: 5, defaultPlanCode: 'INTERMEDIARIO' },
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

  it('teste grátis usa o plano padrão e o acesso informa limites e recursos', async () => {
    const { service } = setup();
    const a = await service.access(1);
    expect(a.plan).toEqual({ code: 'INTERMEDIARIO', name: 'INTERMEDIARIO', tier: 2, maxEstablishments: 3, features: ['QUOTE_DOCUMENT_EDITOR'] });
  });

  it('escolher plano no teste troca o plano na hora e a fatura começa no fim do teste', async () => {
    const { service } = setup();
    await service.overview(1);
    const o = await service.selectPlan(1, 'PRO', 'PIX');
    expect(o.plan!.code).toBe('PRO');
    expect(o.openInvoice!.amountCents).toBe(79900);
    expect(o.openInvoice!.periodStart.toISOString()).toBe('2026-01-24T12:00:00.000Z');
    expect(o.openInvoice!.periodEnd.toISOString()).toBe('2026-02-24T12:00:00.000Z');
  });

  it('upgrade com assinatura paga: começa agora, com crédito do período restante, e só libera após pagar', async () => {
    const { service, clock } = setup();
    await activate(service, clock, 'BASIC'); // período 24/01 → 24/02
    clock.set(new Date('2026-02-08T12:00:00Z')); // metade do período (15 de 31 dias)

    const o = await service.selectPlan(1, 'PRO', 'CARD');
    expect(o.plan!.code).toBe('BASIC'); // ainda não pagou
    const inv = o.openInvoice!;
    expect(inv.periodStart.toISOString()).toBe('2026-02-08T12:00:00.000Z');
    expect(inv.amountCents).toBe(79900 - Math.floor(22990 * 16 / 31));

    const paid = await service.payInvoice(1, inv.id, 'CARD', { cardToken: 'tok_ok' });
    expect(paid.plan!.code).toBe('PRO');
    expect(paid.subscription.currentPeriodEnd.toISOString()).toBe('2026-03-08T12:00:00.000Z');
  });

  it('downgrade com assinatura paga: vale só na renovação', async () => {
    const { service, clock } = setup();
    await activate(service, clock, 'PRO');
    const o = await service.selectPlan(1, 'BASIC', 'CARD');
    expect(o.plan!.code).toBe('PRO');
    expect(o.openInvoice!.periodStart.toISOString()).toBe('2026-02-24T12:00:00.000Z');
    await service.payInvoice(1, o.openInvoice!.id, 'CARD', { cardToken: 'tok_ok' });
    expect((await service.overview(1)).plan!.code).toBe('PRO');

    clock.set(new Date('2026-02-25T12:00:00Z'));
    await service.processLifecycle();
    expect((await service.overview(1)).plan!.code).toBe('BASIC');
  });

  it('cartão aprovado no teste: segue em teste e vira ATIVA na virada do período', async () => {
    const { service, clock } = setup();
    await service.overview(1);
    const { openInvoice } = await service.selectPlan(1, 'BASIC', 'CARD');
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
    const { openInvoice } = await service.selectPlan(1, 'BASIC', 'CARD');
    await expect(service.payInvoice(1, openInvoice!.id, 'CARD', { cardToken: 'tok_recusado' })).rejects.toThrow('recusado');
    expect((await service.overview(1)).openInvoice!.status).toBe('OPEN');
  });

  it('Pix fica pendente até o webhook confirmar (e o webhook é idempotente)', async () => {
    const { service, clock } = setup();
    await service.overview(1);
    clock.advanceDays(20); // teste acabou sem pagar
    await service.processLifecycle();
    expect((await service.overview(1)).subscription.status).toBe('PAST_DUE');

    const { openInvoice } = await service.selectPlan(1, 'BASIC', 'PIX');
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
    const { openInvoice } = await service.selectPlan(1, 'BASIC', 'CARD');
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
    const { openInvoice } = await service.selectPlan(1, 'BASIC', 'CARD');
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
