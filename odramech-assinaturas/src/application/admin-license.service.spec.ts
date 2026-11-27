import { AdminLicenseService } from './admin-license.service';
import { StaticEnterpriseDirectory } from './enterprise-directory';
import { setup } from './test-support';
import { InMemoryEventLogRepository } from '../repositories/in-memory.repositories';

const ADMIN = { id: 1, email: 'dono@odramech.com' };

function adminSetup() {
  const s = setup();
  const log = new InMemoryEventLogRepository();
  s.publisher.attach({ onEvent: e => log.append(e.subscriptionId, e.type, { actor: e.actor, ...e.data }) });
  const directory = new StaticEnterpriseDirectory([
    { id: 1, name: 'Oficina do Zé', cnpj: '11.111.111/0001-11', email: 'ze@x.com', phone: '1' },
    { id: 2, name: 'Oficina do Pai', cnpj: '22.222.222/0001-22', email: 'pai@x.com', phone: '2' },
  ]);
  const admin = new AdminLicenseService(s.plans, s.subs, s.invoices, log, s.publisher, s.service, directory, s.clock, {
    trialDays: 7, graceDays: 7, defaultPlanCode: 'INTERMEDIARIO',
  });
  return { ...s, admin, log };
}

describe('Painel administrativo — licenças', () => {
  it('cortesia sem prazo: acesso total, sem fatura, e nunca expira', async () => {
    const { admin, service, clock, invoices } = adminSetup();
    const d = await admin.grantComplimentary(ADMIN, 2, { planCode: 'INTERMEDIARIO', until: null, enterpriseName: 'Oficina do Pai', note: 'Meu pai' });
    expect(d.kind).toBe('complimentary');
    expect(d.subscription!.adminNote).toBe('Meu pai');

    clock.advanceDays(800);
    await service.processLifecycle();
    const a = await service.access(2);
    expect(a.level).toBe('full');
    expect(a.plan!.code).toBe('INTERMEDIARIO');
    expect(invoices.rows).toHaveLength(0);
  });

  it('cortesia com prazo: quando vence, bloqueia direto (sem tolerância)', async () => {
    const { admin, service, clock } = adminSetup();
    await admin.grantComplimentary(ADMIN, 2, { planCode: 'PRO', until: new Date('2026-03-01T00:00:00Z') });
    clock.set(new Date('2026-03-01T00:00:01Z'));
    expect((await service.access(2)).level).toBe('blocked');
    await service.processLifecycle();
    expect((await service.overview(2)).subscription.status).toBe('EXPIRED');
  });

  it('a oficina com cortesia não consegue trocar de plano sozinha', async () => {
    const { admin, service } = adminSetup();
    await admin.grantComplimentary(ADMIN, 2, { planCode: 'BASIC', until: null });
    await expect(service.selectPlan(2, 'ULTRA', 'CARD')).rejects.toThrow('cortesia');
  });

  it('suspensão bloqueia tudo, inclusive assinatura paga, e impede pagar para sair', async () => {
    const { admin, service } = adminSetup();
    await service.overview(1);
    const { openInvoice } = await service.selectPlan(1, 'PRO', 'CARD');
    await service.payInvoice(1, openInvoice!.id, 'CARD', { cardToken: 'tok_ok' });
    expect((await service.access(1)).level).toBe('full');

    await admin.suspend(ADMIN, 1, 'chargeback');
    const a = await service.access(1);
    expect(a.level).toBe('blocked');
    expect(a.reason).toContain('chargeback');
    await expect(service.selectPlan(1, 'BASIC', 'PIX')).rejects.toThrow('suspensa');

    await admin.unsuspend(ADMIN, 1);
    expect((await service.access(1)).level).toBe('full');
  });

  it('revogar cortesia bloqueia na hora', async () => {
    const { admin, service } = adminSetup();
    await admin.grantComplimentary(ADMIN, 2, { planCode: 'BASIC', until: null });
    await admin.revokeComplimentary(ADMIN, 2);
    expect((await service.access(2)).level).toBe('blocked');
  });

  it('estender teste vencido reabre como teste', async () => {
    const { admin, service, clock } = adminSetup();
    await service.overview(1);
    clock.advanceDays(10);
    await service.processLifecycle();
    expect((await service.access(1)).level).toBe('blocked');

    const d = await admin.setPeriodEnd(ADMIN, 1, new Date('2026-02-01T00:00:00Z'));
    expect(d.subscription!.status).toBe('TRIALING');
    expect((await service.access(1)).level).toBe('full');
  });

  it('marcar fatura como paga (recebida por fora) ativa a assinatura', async () => {
    const { admin, service } = adminSetup();
    await service.overview(1);
    const { openInvoice } = await service.selectPlan(1, 'PRO', 'BOLETO');
    const d = await admin.markInvoicePaid(ADMIN, openInvoice!.id);
    expect(d!.subscription!.status).toBe('ACTIVE');
    expect(d!.plan!.code).toBe('PRO');
  });

  it('toda ação do painel fica na auditoria com o autor', async () => {
    const { admin, log } = adminSetup();
    await admin.grantComplimentary(ADMIN, 2, { planCode: 'BASIC', until: null });
    await admin.changePlan(ADMIN, 2, 'ULTRA');
    const types = log.rows.map(r => r.type);
    expect(types).toEqual(expect.arrayContaining(['license.created', 'license.plan_changed']));
    expect(log.rows.every(r => (r.payload as any).actor === 'admin:1 dono@odramech.com')).toBe(true);
  });

  it('lista inclui empresas da oficina que ainda não têm licença', async () => {
    const { admin, service } = adminSetup();
    await service.overview(1);
    const { licenses } = await admin.list();
    expect(licenses.map(l => [l.enterpriseId, l.kind])).toEqual([[1, 'trial'], [2, 'none']]);
  });

  it('preço novo do plano vale para as próximas faturas', async () => {
    const { admin, service } = adminSetup();
    await admin.updatePlan(1, { priceCents: 19990 });
    await service.overview(1);
    const { openInvoice } = await service.selectPlan(1, 'BASIC', 'PIX');
    expect(openInvoice!.amountCents).toBe(19990);
  });
});

describe('Privacidade', () => {
  it('a anotação interna do administrador não aparece para a oficina', async () => {
    const { admin, service } = adminSetup();
    await admin.grantComplimentary(ADMIN, 2, { planCode: 'BASIC', until: null, note: 'é o meu pai' });
    const o = await service.overview(2);
    expect(JSON.stringify(o)).not.toContain('meu pai');
  });
});
