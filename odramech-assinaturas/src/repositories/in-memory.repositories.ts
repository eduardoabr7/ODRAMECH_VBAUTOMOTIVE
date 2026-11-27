import { randomUUID } from 'node:crypto';
import { Invoice, NewInvoice, NewSubscription, Plan, Subscription } from '../domain/model';
import { EventLogRepository, InvoiceRepository, PlanRepository, SubscriptionRepository } from './repositories';

/**
 * REPOSITORIES em memória — mesmo contrato das versões Prisma.
 * Permitem testar todas as regras de cobrança sem banco (ver *.spec.ts).
 */

export class InMemoryPlanRepository extends PlanRepository {
  constructor(private readonly plans: Plan[]) { super(); }
  async listActive() { return this.plans.filter(p => p.active).sort((a, b) => a.sortOrder - b.sortOrder); }
  async findByCode(code: string) { return this.plans.find(p => p.code === code) ?? null; }
  async findById(id: number) { return this.plans.find(p => p.id === id) ?? null; }
}

export class InMemorySubscriptionRepository extends SubscriptionRepository {
  readonly rows: Subscription[] = [];
  async findByEnterprise(enterpriseId: number) { return this.rows.find(s => s.enterpriseId === enterpriseId) ?? null; }
  async findById(id: string) { return this.rows.find(s => s.id === id) ?? null; }
  async create(data: NewSubscription) {
    const now = new Date();
    const row: Subscription = { ...data, id: randomUUID(), createdAt: now, updatedAt: now };
    this.rows.push(row);
    return { ...row };
  }
  async update(id: string, data: Partial<NewSubscription>) {
    const row = this.rows.find(s => s.id === id);
    if (!row) throw new Error('not found');
    Object.assign(row, data, { updatedAt: new Date() });
    return { ...row };
  }
  async dueForProcessing(until: Date) {
    return this.rows.filter(s => s.status !== 'EXPIRED' && s.currentPeriodEnd <= until).map(s => ({ ...s }));
  }
  async listAll() { return this.rows.map(s => ({ ...s })); }
}

export class InMemoryInvoiceRepository extends InvoiceRepository {
  readonly rows: Invoice[] = [];
  private seq = 1;
  async create(data: NewInvoice) {
    const row: Invoice = { ...data, id: randomUUID(), number: this.seq++, createdAt: new Date() };
    this.rows.push(row);
    return { ...row };
  }
  async update(id: string, data: Partial<NewInvoice>) {
    const row = this.rows.find(i => i.id === id);
    if (!row) throw new Error('not found');
    Object.assign(row, data);
    return { ...row };
  }
  async findById(id: string) { return this.rows.find(i => i.id === id) ?? null; }
  async findByGatewayRef(ref: string) { return this.rows.find(i => i.gatewayRef === ref) ?? null; }
  async listBySubscription(subscriptionId: string, take: number) {
    return this.rows.filter(i => i.subscriptionId === subscriptionId)
      .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime()).slice(0, take);
  }
  async findOpen(subscriptionId: string) {
    return this.rows.filter(i => i.subscriptionId === subscriptionId && i.status === 'OPEN')
      .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime())[0] ?? null;
  }
}

export class InMemoryEventLogRepository extends EventLogRepository {
  readonly rows: { subscriptionId: string; type: string; payload: unknown }[] = [];
  async append(subscriptionId: string, type: string, payload: unknown) {
    this.rows.push({ subscriptionId, type, payload });
  }
}
