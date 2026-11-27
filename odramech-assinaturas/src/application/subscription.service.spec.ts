import { SubscriptionService } from './subscription.service';
import { Invoice } from '../domain/model';
import { addMonthsClamped, cycleFor } from '../domain/billing-cycle.strategy';
import { decideAccess } from '../domain/access-policy';
import { ChargeResult, ChargeStatus, PaymentGateway } from '../payments/payment-provider';
import { activate, setup, signedWebhook } from './test-support';

describe('Ciclos de cobrança (Strategy)', () => {
  it('mensal soma um mês e respeita fim de mês', () => {
    expect(addMonthsClamped(new Date('2026-01-31T00:00:00Z'), 1).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(cycleFor('MONTHLY').periodEnd(new Date('2026-03-15T00:00:00Z')).toISOString()).toBe('2026-04-15T00:00:00.000Z');
  });

  it('anual soma 12 meses (inclusive 29/02)', () => {
    expect(cycleFor('YEARLY').periodEnd(new Date('2028-02-29T00:00:00Z')).toISOString()).toBe('2029-02-28T00:00:00.000Z');
  });
});

describe('Teste grátis', () => {
  it('primeiro acesso inicia teste grátis de 7 dias', async () => {
    const { service, events } = setup();
    const o = await service.overview(1, 'Oficina do Zé');
    expect(o.subscription.status).toBe('TRIALING');
    expect(o.access.level).toBe('full');
    expect(o.subscription.currentPeriodEnd.toISOString()).toBe('2026-01-17T12:00:00.000Z');
    expect(events.map(e => e.type)).toContain('subscription.trial_started');
  });

  it('usa o plano padrão e o acesso informa limites e recursos', async () => {
    const { service } = setup();
    const a = await service.access(1);
    expect(a.plan).toEqual({ code: 'INTERMEDIARIO', name: 'INTERMEDIARIO', tier: 2, maxEstablishments: 3, features: ['QUOTE_DOCUMENT_EDITOR'] });
  });

  it('BRECHA: escolher plano maior no teste NÃO libera o plano sem pagar', async () => {
    const { service } = setup();
    await service.overview(1);
    const o = await service.selectPlan(1, 'ULTRA', 'PIX');
    expect(o.plan!.code).toBe('INTERMEDIARIO'); // continua no plano do teste
    expect((await service.access(1)).plan!.code).toBe('INTERMEDIARIO');
    expect(o.openInvoice!.amountCents).toBe(239900);
    expect(o.openInvoice!.periodStart.toISOString()).toBe('2026-01-10T12:00:00.000Z'); // cobra a partir de agora
  });

  it('pagou no teste: vira ATIVA na hora, no plano escolhido', async () => {
    const { service } = setup();
    const paid = await activate(service, 'PRO');
    expect(paid.invoice.status).toBe('PAID');
    expect(paid.subscription.status).toBe('ACTIVE');
    expect(paid.plan!.code).toBe('PRO');
    expect(paid.subscription.currentPeriodEnd.toISOString()).toBe('2026-02-10T12:00:00.000Z');
  });

  it('BRECHA: teste vencido bloqueia no mesmo instante, mesmo antes do agendador rodar', async () => {
    const { service, clock } = setup();
    await service.overview(1);
    clock.advanceDays(7);
    const a = await service.access(1);
    expect(a.level).toBe('blocked');
    expect(a.reason).toContain('teste');
  });

  it('BRECHA: teste vencido expira direto, sem os 7 dias de tolerância', async () => {
    const { service, clock } = setup();
    await service.overview(1);
    clock.advanceDays(8);
    await service.processLifecycle();
    const o = await service.overview(1);
    expect(o.subscription.status).toBe('EXPIRED');
    expect(o.access.level).toBe('blocked');
  });

  it('teste nunca gera fatura sozinho', async () => {
    const { service, clock, invoices } = setup();
    await service.overview(1);
    clock.advanceDays(4); // dentro da janela de renovação
    await service.processLifecycle();
    expect(invoices.rows).toHaveLength(0);
  });

  it('teste vencido, depois paga: libera um período inteiro a partir do pagamento', async () => {
    const { service, clock } = setup();
    await service.overview(1);
    const { openInvoice } = await service.selectPlan(1, 'BASIC', 'PIX'); // gerou no dia 10
    clock.advanceDays(10);
    await service.processLifecycle(); // expira
    await service.payInvoice(1, openInvoice!.id, 'PIX', {});
    const o = await service.simulatePayment(1, openInvoice!.id);
    expect(o.subscription.status).toBe('ACTIVE');
    expect(o.subscription.currentPeriodStart.toISOString()).toBe('2026-01-20T12:00:00.000Z');
    expect(o.subscription.currentPeriodEnd.toISOString()).toBe('2026-02-20T12:00:00.000Z');
  });
});

describe('Assinatura paga', () => {
  it('upgrade: começa agora, com crédito do período restante, e só libera após pagar', async () => {
    const { service, clock } = setup();
    await activate(service, 'BASIC'); // período 10/01 → 10/02
    clock.set(new Date('2026-01-26T12:00:00Z')); // 16 dias usados, 15 restantes (de 31)

    const o = await service.selectPlan(1, 'PRO', 'CARD');
    expect(o.plan!.code).toBe('BASIC'); // ainda não pagou
    const inv = o.openInvoice!;
    expect(inv.periodStart.toISOString()).toBe('2026-01-26T12:00:00.000Z');
    expect(inv.amountCents).toBe(79900 - Math.floor(22990 * 15 / 31));

    const paid = await service.payInvoice(1, inv.id, 'CARD', { cardToken: 'tok_ok' });
    expect(paid.plan!.code).toBe('PRO');
    expect(paid.subscription.currentPeriodEnd.toISOString()).toBe('2026-02-26T12:00:00.000Z');
  });

  it('downgrade: vale só na renovação', async () => {
    const { service, clock } = setup();
    await activate(service, 'PRO');
    const o = await service.selectPlan(1, 'BASIC', 'CARD');
    expect(o.plan!.code).toBe('PRO');
    expect(o.openInvoice!.periodStart.toISOString()).toBe('2026-02-10T12:00:00.000Z');
    await service.payInvoice(1, o.openInvoice!.id, 'CARD', { cardToken: 'tok_ok' });
    expect((await service.overview(1)).plan!.code).toBe('PRO');

    clock.set(new Date('2026-02-11T12:00:00Z'));
    await service.processLifecycle();
    expect((await service.overview(1)).plan!.code).toBe('BASIC');
  });

  it('cartão recusado não altera a fatura para paga', async () => {
    const { service } = setup();
    await service.overview(1);
    const { openInvoice } = await service.selectPlan(1, 'BASIC', 'CARD');
    await expect(service.payInvoice(1, openInvoice!.id, 'CARD', { cardToken: 'tok_recusado' })).rejects.toThrow('recusado');
    expect((await service.overview(1)).openInvoice!.status).toBe('OPEN');
  });

  it('sem pagamento: inadimplente com tolerância e depois expira (bloqueia)', async () => {
    const { service, clock } = setup();
    await activate(service, 'BASIC'); // até 10/02

    clock.set(new Date('2026-02-11T12:00:00Z'));
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
    await activate(service, 'BASIC');
    await service.cancel(1);
    let o = await service.overview(1);
    expect(o.subscription.cancelAtPeriodEnd).toBe(true);
    expect(o.access.level).toBe('full');

    clock.advanceDays(32);
    await service.processLifecycle();
    o = await service.overview(1);
    expect(o.subscription.status).toBe('CANCELED');
    expect(o.access.level).toBe('blocked');
  });

  it('renovação: gera a fatura do próximo mês alguns dias antes do vencimento', async () => {
    const { service, clock, invoices } = setup();
    await activate(service, 'BASIC'); // até 10/02
    clock.set(new Date('2026-02-06T12:00:00Z')); // 4 dias antes
    await service.processLifecycle();
    const open = invoices.rows.filter(i => i.status === 'OPEN');
    expect(open).toHaveLength(1);
    expect(open[0].periodStart.toISOString()).toBe('2026-02-10T12:00:00.000Z');
  });
});

describe('Webhook de pagamento (segurança)', () => {
  async function pendingPix(s: ReturnType<typeof setup>) {
    await s.service.overview(1);
    const { openInvoice } = await s.service.selectPlan(1, 'BASIC', 'PIX');
    const pending = await s.service.payInvoice(1, openInvoice!.id, 'PIX', {});
    return pending.invoice;
  }

  it('Pix fica pendente até o webhook assinado confirmar (e é idempotente)', async () => {
    const s = setup();
    const inv = await pendingPix(s);
    expect(inv.status).toBe('OPEN');
    expect(inv.instructions?.pixCode).toBeTruthy();

    const w = signedWebhook({ event: 'PAYMENT_CONFIRMED', reference: inv.gatewayRef });
    expect(await s.service.handleWebhook(w.headers, w.body, w.raw)).toEqual({ paid: true });
    expect(await s.service.handleWebhook(w.headers, w.body, w.raw)).toEqual({ alreadyPaid: true });

    const o = await s.service.overview(1);
    expect(o.subscription.status).toBe('ACTIVE');
    expect(o.access.level).toBe('full');
  });

  it('BRECHA: webhook sem assinatura é recusado e nada é liberado', async () => {
    const s = setup();
    const inv = await pendingPix(s);
    await expect(s.service.handleWebhook({}, { event: 'PAYMENT_CONFIRMED', reference: inv.gatewayRef })).rejects.toThrow('Assinatura');
    expect((await s.service.overview(1)).subscription.status).toBe('TRIALING');
  });

  it('BRECHA: webhook assinado com outro segredo é recusado', async () => {
    const s = setup();
    const inv = await pendingPix(s);
    const w = signedWebhook({ event: 'PAYMENT_CONFIRMED', reference: inv.gatewayRef }, 'segredo-do-atacante-1234');
    await expect(s.service.handleWebhook(w.headers, w.body, w.raw)).rejects.toThrow('Assinatura');
  });

  it('BRECHA: corpo alterado depois de assinado é recusado', async () => {
    const s = setup();
    const inv = await pendingPix(s);
    const w = signedWebhook({ event: 'PAYMENT_FAILED', reference: inv.gatewayRef });
    const tampered = Buffer.from(JSON.stringify({ event: 'PAYMENT_CONFIRMED', reference: inv.gatewayRef }));
    await expect(s.service.handleWebhook(w.headers, JSON.parse(tampered.toString()), tampered)).rejects.toThrow('Assinatura');
  });

  it('BRECHA: provedor diz que pagou MENOS que a fatura → não libera e registra para revisão', async () => {
    // provedor de mentira que confirma qualquer cobrança, mas com valor de R$ 1,00
    const cheap: PaymentGateway = {
      provider: 'fake',
      async createPixCharge(_i: Invoice): Promise<ChargeResult> { return { status: 'pending', gatewayRef: 'pix_x', instructions: { kind: 'PIX' } }; },
      async chargeCard(): Promise<ChargeResult> { return { status: 'paid', gatewayRef: 'card_x', instructions: null }; },
      async issueBoleto(): Promise<ChargeResult> { return { status: 'pending', gatewayRef: 'bol_x', instructions: null }; },
      async fetchCharge(): Promise<ChargeStatus> { return { status: 'paid', amountCents: 100, currency: 'BRL' }; },
    };
    const s = setup({ gateway: cheap });
    await s.service.overview(1);
    const { openInvoice } = await s.service.selectPlan(1, 'ULTRA', 'CARD');
    const r = await s.service.payInvoice(1, openInvoice!.id, 'CARD', { cardToken: 'tok' });
    expect(r.invoice.status).toBe('OPEN');
    expect(r.plan!.code).toBe('INTERMEDIARIO');
    expect(s.events.map(e => e.type)).toContain('invoice.amount_mismatch');

    const w = signedWebhook({ event: 'PAYMENT_CONFIRMED', reference: 'card_x' });
    expect(await s.service.handleWebhook(w.headers, w.body, w.raw)).toMatchObject({ ignored: true });
    expect((await s.service.overview(1)).subscription.status).toBe('TRIALING');
  });

  it('BRECHA: cobrança que o provedor não conhece não é liberada', async () => {
    const s = setup();
    const inv = await pendingPix(s);
    // outra instância do sandbox = provedor sem registro dessa cobrança
    const fresh = setup();
    (fresh.service as any).invoices = s.invoices;
    (fresh.service as any).subs = s.subs;
    const w = signedWebhook({ event: 'PAYMENT_CONFIRMED', reference: inv.gatewayRef });
    expect(await fresh.service.handleWebhook(w.headers, w.body, w.raw)).toMatchObject({ ignored: true });
  });

  it('BRECHA: pagamentos desativados (sandbox em produção) → pagar e webhook recusados', async () => {
    const s = setup({ paymentsEnabled: false });
    await s.service.overview(1);
    const { openInvoice } = await s.service.selectPlan(1, 'ULTRA', 'CARD');
    await expect(s.service.payInvoice(1, openInvoice!.id, 'CARD', { cardToken: 'tok_ok' })).rejects.toThrow('não disponível');
    const w = signedWebhook({ event: 'PAYMENT_CONFIRMED', reference: 'qualquer' });
    await expect(s.service.handleWebhook(w.headers, w.body, w.raw)).rejects.toThrow('desativados');
  });
});

describe('Política de acesso', () => {
  it('sem assinatura → acesso liberado (primeiro acesso)', () => {
    expect(decideAccess(null, 7, new Date()).level).toBe('full');
  });
});
