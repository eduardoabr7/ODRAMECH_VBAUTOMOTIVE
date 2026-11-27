// Modelo de domínio — sem dependência de Nest ou Prisma.

export type BillingInterval = 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
export type InvoiceStatus = 'OPEN' | 'PAID' | 'VOID';
export type PaymentMethod = 'PIX' | 'CARD' | 'BOLETO';

export interface Plan {
  id: number;
  code: string;
  name: string;
  interval: BillingInterval;
  priceCents: number;
  currency: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
}

export interface Subscription {
  id: string;
  enterpriseId: number;
  enterpriseName: string | null;
  planId: number;
  status: SubscriptionStatus;
  paymentMethod: PaymentMethod | null;
  trialEndsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentInstructions {
  /** o que mostrar ao cliente: código Pix copia‑e‑cola, linha digitável, etc. */
  kind: PaymentMethod;
  pixCode?: string;
  boletoLine?: string;
  expiresAt?: string;
  note?: string;
}

export interface Invoice {
  id: string;
  number: number;
  subscriptionId: string;
  planCode: string;
  amountCents: number;
  status: InvoiceStatus;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  paidAt: Date | null;
  method: PaymentMethod | null;
  gatewayRef: string | null;
  instructions: PaymentInstructions | null;
  createdAt: Date;
}

export type NewSubscription = Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>;
export type NewInvoice = Omit<Invoice, 'id' | 'number' | 'createdAt'>;

export const DAY_MS = 24 * 60 * 60 * 1000;
