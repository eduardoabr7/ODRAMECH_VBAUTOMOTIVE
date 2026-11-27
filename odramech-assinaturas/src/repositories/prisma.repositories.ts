import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { SubscriptionsConfig } from '../config/subscriptions-config';
import { Invoice, NewInvoice, NewSubscription, PaymentInstructions, Plan, Subscription } from '../domain/model';
import { EventLogRepository, InvoiceRepository, LoggedEvent, PlanChanges, PlanRepository, SubscriptionRepository } from './repositories';

/** Única conexão do serviço com o banco. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ datasources: { db: { url: SubscriptionsConfig.get().values.databaseUrl } } });
  }
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}

// Mapeamento Prisma → domínio (mantém o domínio livre de tipos do ORM)
const toInvoice = (row: any): Invoice => ({ ...row, instructions: (row.instructions ?? null) as PaymentInstructions | null });
const json = (v: unknown) => (v === null || v === undefined ? Prisma.JsonNull : (v as Prisma.InputJsonValue));

@Injectable()
export class PrismaPlanRepository extends PlanRepository {
  constructor(private readonly db: PrismaService) { super(); }
  listActive(): Promise<Plan[]> {
    return this.db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
  }
  listAll(): Promise<Plan[]> {
    return this.db.plan.findMany({ orderBy: { sortOrder: 'asc' } });
  }
  create(data: Omit<Plan, 'id'>): Promise<Plan> {
    return this.db.plan.create({ data });
  }
  update(id: number, data: PlanChanges): Promise<Plan> {
    return this.db.plan.update({ where: { id }, data });
  }
  findByCode(code: string): Promise<Plan | null> {
    return this.db.plan.findUnique({ where: { code } });
  }
  findById(id: number): Promise<Plan | null> {
    return this.db.plan.findUnique({ where: { id } });
  }
}

@Injectable()
export class PrismaSubscriptionRepository extends SubscriptionRepository {
  constructor(private readonly db: PrismaService) { super(); }
  findByEnterprise(enterpriseId: number) {
    return this.db.subscription.findUnique({ where: { enterpriseId } });
  }
  findById(id: string) {
    return this.db.subscription.findUnique({ where: { id } });
  }
  create(data: NewSubscription) {
    return this.db.subscription.create({ data });
  }
  update(id: string, data: Partial<NewSubscription>) {
    return this.db.subscription.update({ where: { id }, data });
  }
  dueForProcessing(until: Date) {
    return this.db.subscription.findMany({
      where: { status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED'] }, currentPeriodEnd: { lte: until } },
      take: 500,
    });
  }
  listAll() {
    return this.db.subscription.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 });
  }
}

@Injectable()
export class PrismaInvoiceRepository extends InvoiceRepository {
  constructor(private readonly db: PrismaService) { super(); }
  async create(data: NewInvoice) {
    return toInvoice(await this.db.invoice.create({ data: { ...data, instructions: json(data.instructions) } }));
  }
  async update(id: string, data: Partial<NewInvoice>) {
    const { instructions, ...rest } = data;
    return toInvoice(await this.db.invoice.update({
      where: { id },
      data: { ...rest, ...(instructions !== undefined ? { instructions: json(instructions) } : {}) },
    }));
  }
  async findById(id: string) {
    const row = await this.db.invoice.findUnique({ where: { id } });
    return row ? toInvoice(row) : null;
  }
  async findByGatewayRef(ref: string) {
    const row = await this.db.invoice.findFirst({ where: { gatewayRef: ref } });
    return row ? toInvoice(row) : null;
  }
  async listBySubscription(subscriptionId: string, take: number) {
    return (await this.db.invoice.findMany({ where: { subscriptionId }, orderBy: { periodStart: 'desc' }, take })).map(toInvoice);
  }
  async findOpen(subscriptionId: string) {
    const row = await this.db.invoice.findFirst({ where: { subscriptionId, status: 'OPEN' }, orderBy: { periodStart: 'asc' } });
    return row ? toInvoice(row) : null;
  }
}

@Injectable()
export class PrismaEventLogRepository extends EventLogRepository {
  constructor(private readonly db: PrismaService) { super(); }
  async append(subscriptionId: string, type: string, payload: unknown) {
    await this.db.subscriptionEvent.create({ data: { subscriptionId, type, payload: json(payload) } });
  }
  listBySubscription(subscriptionId: string, take: number): Promise<LoggedEvent[]> {
    return this.db.subscriptionEvent.findMany({ where: { subscriptionId }, orderBy: { createdAt: 'desc' }, take });
  }
  listRecent(take: number): Promise<LoggedEvent[]> {
    return this.db.subscriptionEvent.findMany({ orderBy: { createdAt: 'desc' }, take });
  }
}
