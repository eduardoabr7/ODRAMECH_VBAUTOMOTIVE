export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
export type PaymentMethod = 'PIX' | 'CARD' | 'BOLETO';
export type AccessLevel = 'full' | 'grace' | 'blocked';

export interface Plan {
  id: number;
  code: string;
  name: string;
  interval: 'MONTHLY' | 'YEARLY';
  intervalLabel: string;
  priceCents: number;
  monthlyEquivalentCents: number;
  savingsPercent: number;
  description: string | null;
  /** 1 = Basic … 4 = Ultra */
  tier: number;
  /** null = ilimitado */
  maxEstablishments: number | null;
  features: string[];
}

/** O que o plano vigente libera (vem junto da decisão de acesso). */
export interface PlanEntitlements {
  code: string;
  name: string;
  tier: number;
  maxEstablishments: number | null;
  features: string[];
}

export const PLAN_FEATURE_LABEL: Record<string, string> = {
  QUOTE_DOCUMENT_EDITOR: 'Documento de orçamento personalizado (HTML)',
  LOGIN_CUSTOMIZATION: 'Tela de login com a sua marca',
};

export interface PaymentInstructions {
  kind: PaymentMethod;
  pixCode?: string;
  boletoLine?: string;
  expiresAt?: string;
  note?: string;
}

export interface Invoice {
  id: string;
  number: number;
  planCode: string;
  amountCents: number;
  status: 'OPEN' | 'PAID' | 'VOID';
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paidAt: string | null;
  method: PaymentMethod | null;
  gatewayRef: string | null;
  instructions: PaymentInstructions | null;
}

export interface Subscription {
  id: string;
  status: SubscriptionStatus;
  paymentMethod: PaymentMethod | null;
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface AccessDecision {
  status?: string;
  level: AccessLevel;
  until: string | null;
  reason: string;
  degraded?: boolean;
  plan?: PlanEntitlements | null;
}

export interface SubscriptionOverview {
  subscription: Subscription;
  plan: Plan;
  access: AccessDecision;
  openInvoice: Invoice | null;
  invoices: Invoice[];
  plans: Plan[];
  paymentMethods: { method: PaymentMethod; label: string }[];
  enforcement: 'off' | 'warn' | 'block';
  canManage: boolean;
  /** "Simular pagamento" (sandbox) — falso em produção */
  canSimulate: boolean;
  /** estabelecimentos que a empresa já tem (limita a escolha de plano) */
  establishmentCount: number;
}

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  TRIALING: 'Período de teste',
  ACTIVE: 'Ativa',
  PAST_DUE: 'Pagamento pendente',
  CANCELED: 'Cancelada',
  EXPIRED: 'Expirada',
};
