import { ItemKind, Role } from '@prisma/client';
import { ServiceItemFactory } from './factories/service-item.factory';
import { FinancialReportBuilder } from './reports/financial-report.builder';
import { PaymentRepository, ReviewRepository } from './repositories/billing.repositories';
import { UserFactory } from 'src/user/factories/user.factory';
import { BcryptService } from 'src/crypto/bcrypt.service';

describe('ServiceItemFactory (Factory)', () => {
  it('normaliza texto e valores', () => {
    const item = ServiceItemFactory.create({ kind: ItemKind.PECA, description: '  Pastilha   dianteira ', quantity: 2, unitPrice: 89.905, discount: 0 });
    expect(item).toEqual({ kind: ItemKind.PECA, description: 'Pastilha dianteira', quantity: 2, unitPrice: 89.91, discount: 0, partId: null });
  });

  it('recusa desconto maior que o valor da linha', () => {
    expect(() => ServiceItemFactory.create({ kind: ItemKind.SERVICO, description: 'Mão de obra', quantity: 1, unitPrice: 100, discount: 150 }))
      .toThrow('desconto');
  });
});

describe('FinancialReportBuilder (Builder)', () => {
  const payments = {
    sumPaid: async (_e: number, since: Date) => (since.getDate() === 1 ? 1000 : 150),
    finishedWithMoney: async () => [
      { items: [{ quantity: 1, unitPrice: 300, discount: 0 }], payments: [{ amount: 100 }] }, // deve 200
      { items: [{ quantity: 1, unitPrice: 50, discount: 0 }], payments: [{ amount: 80 }] },   // pagou a mais → 0
    ],
  } as unknown as PaymentRepository;
  const reviews = { average: async () => ({ avg: 4.666, count: 3 }) } as unknown as ReviewRepository;

  it('monta só as partes pedidas', async () => {
    const r = await new FinancialReportBuilder(payments, reviews, { establishmentId: 1 }, new Date('2026-03-15T12:00:00')).withRatings().build();
    expect(r.ratingAvg).toBe(4.67);
    expect(r.revenueToday).toBe(0); // não pediu receita
  });

  it('relatório completo: receita, a receber (sem negativos) e avaliação', async () => {
    const r = await new FinancialReportBuilder(payments, reviews, { establishmentId: 1 }, new Date('2026-03-15T12:00:00'))
      .withRevenue().withReceivables().withRatings().build();
    expect(r).toMatchObject({ revenueToday: 150, revenueMonth: 1000, receivable: 200, ratingCount: 3 });
  });
});

describe('UserFactory (Factory)', () => {
  const factory = new UserFactory({ hashPassword: async (p: string) => `hash(${p})` } as unknown as BcryptService);
  const input = { name: '  Maria   Silva ', gender: 'F' as const, email: 'Maria@Email.COM', password: 'segredo', principalPhone: '(51) 99999-0000' };

  it('mecânico cria cliente, com dados normalizados e senha com hash', async () => {
    const data = await factory.createClient(input, { enterpriseId: 1, establishmentId: 2, requesterRole: Role.WORKER });
    expect(data.user).toMatchObject({ name: 'Maria Silva', email: 'maria@email.com', password: 'hash(segredo)', principalPhone: '51999990000' });
    expect(data.membership).toEqual({ role: Role.USER, enterpriseId: 1, establishmentId: 2, active: true });
  });

  it('cadastro pode nascer desativado', async () => {
    const data = await factory.createClient({ ...input, active: false }, { enterpriseId: 1, establishmentId: 2, requesterRole: Role.ADMIN });
    expect(data.membership.active).toBe(false);
  });

  it('mecânico não cria administrador', async () => {
    await expect(factory.createStaff(Role.ADMIN, input, { enterpriseId: 1, establishmentId: 2, requesterRole: Role.WORKER }))
      .rejects.toThrow('administrativo');
  });
});
