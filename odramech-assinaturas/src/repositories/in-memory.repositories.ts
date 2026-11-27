import { randomUUID } from 'node:crypto';
import { Invoice, NewInvoice, NewSubscription, Plan, Subscription } from '../domain/model';
import { EventLogRepository, InvoiceRepository, LoggedEvent, PlanChanges, PlanRepository, SubscriptionRepository } from './repositories';

/**
 * REPOSITORIES em memória — mesmo contrato das versões Prisma.
 * Permitem testar todas as regras de cobrança sem banco (ver *.spec.ts).
 */

export class InMemoryPlanRepository extends PlanRepository {
  private readonly plans: Plan[];
  constructor(plans: Plan[]) { super(); this.plans = plans.map(p => ({ ...p })); }
  async listActive() { return this.plans.filter(p => p.active).sort((a, b) => a.sortOrder - b.sortOrder); }
  async listAll() { return [...this.plans].sort((a, b) => a.sortOrder - b.sortOrder); }
  async findByCode(code: string) { return this.plans.find(p => p.code === code) ?? null; }
  async findById(id: number) { return this.plans.find(p => p.id === id) ?? null; }
  async create(data: Omit<Plan, 'id'>) {
    const row = { ...data, id: Math.max(0, ...this.plans.map(p => p.id)) + 1 };
    this.plans.push(row);
    return { ...row };
  }
  async update(id: number, data: PlanChanges) {
    const row = this.plans.find(p => p.id === id);
    if (!row) throw new Error('not found');
    Object.assign(row, data);
    return { ...row };
  }
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
  readonly rows: LoggedEvent[] = [];
  async append(subscriptionId: string, type: string, payload: unknown) {
    this.rows.push({ id: this.rows.length + 1, subscriptionId, type, payload, createdAt: new Date() });
  }
  async listBySubscription(subscriptionId: string, take: number) {
    return this.rows.filter(r => r.subscriptionId === subscriptionId).reverse().slice(0, take);
  }
  async listRecent(take: number) { return [...this.rows].reverse().slice(0, take); }
}
