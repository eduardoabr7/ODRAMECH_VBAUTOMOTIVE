import { Invoice, NewInvoice, NewSubscription, Plan, Subscription } from '../domain/model';

/** REPOSITORIES (portas) — o domínio fala com estas abstrações, nunca com o Prisma. */

export type PlanChanges = Partial<Omit<Plan, 'id' | 'code'>>;

export abstract class PlanRepository {
  abstract listActive(): Promise<Plan[]>;
  /** inclusive os desativados (painel administrativo) */
  abstract listAll(): Promise<Plan[]>;
  abstract findByCode(code: string): Promise<Plan | null>;
  abstract findById(id: number): Promise<Plan | null>;
  abstract create(data: Omit<Plan, 'id'>): Promise<Plan>;
  abstract update(id: number, data: PlanChanges): Promise<Plan>;
}

export abstract class SubscriptionRepository {
  abstract findByEnterprise(enterpriseId: number): Promise<Subscription | null>;
  abstract findById(id: string): Promise<Subscription | null>;
  abstract create(data: NewSubscription): Promise<Subscription>;
  abstract update(id: string, data: Partial<NewSubscription>): Promise<Subscription>;
  /** candidatas a processamento do agendador (período acabando/acabado) */
  abstract dueForProcessing(until: Date): Promise<Subscription[]>;
  abstract listAll(): Promise<Subscription[]>;
}

export abstract class InvoiceRepository {
  abstract create(data: NewInvoice): Promise<Invoice>;
  abstract update(id: string, data: Partial<NewInvoice>): Promise<Invoice>;
  abstract findById(id: string): Promise<Invoice | null>;
  abstract findByGatewayRef(ref: string): Promise<Invoice | null>;
  abstract listBySubscription(subscriptionId: string, take: number): Promise<Invoice[]>;
  abstract findOpen(subscriptionId: string): Promise<Invoice | null>;
}

export interface LoggedEvent {
  id: number;
  subscriptionId: string;
  type: string;
  payload: unknown;
  createdAt: Date;
}

export abstract class EventLogRepository {
  abstract append(subscriptionId: string, type: string, payload: unknown): Promise<void>;
  abstract listBySubscription(subscriptionId: string, take: number): Promise<LoggedEvent[]>;
  abstract listRecent(take: number): Promise<LoggedEvent[]>;
}
