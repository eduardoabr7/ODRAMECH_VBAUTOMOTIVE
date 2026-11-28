export type LicenseKind = 'trial' | 'paid' | 'complimentary' | 'suspended' | 'none';
export type AccessLevel = 'full' | 'grace' | 'blocked';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';

export interface Admin {
  id: number;
  email: string;
  name: string;
  totpEnabled: boolean;
}

export interface Plan {
  id: number;
  code: string;
  name: string;
  interval: 'MONTHLY' | 'YEARLY';
  priceCents: number;
  currency: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  tier: number;
  maxEstablishments: number | null;
  features: string[];
}

export interface Subscription {
  id: string;
  enterpriseId: number;
  enterpriseName: string | null;
  status: SubscriptionStatus;
  planId: number;
  paymentMethod: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  complimentary: boolean;
  complimentaryUntil: string | null;
  foreverComplimentary: boolean;
  suspended: boolean;
  suspendedReason: string | null;
  adminNote: string | null;
  createdAt: string;
}

export interface AccessDecision {
  level: AccessLevel;
  until: string | null;
  reason: string;
}

export interface LicenseRow {
  enterpriseId: number;
  enterpriseName: string | null;
  cnpj: string | null;
  email: string | null;
  subscription: Subscription | null;
  plan: { code: string; name: string; tier: number; maxEstablishments: number | null; features: string[]; priceCents: number } | null;
  access: AccessDecision | null;
  kind: LicenseKind;
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
  method: string | null;
}

export interface AuditEvent {
  id: number;
  subscriptionId: string;
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  enterpriseId?: number | null;
  enterpriseName?: string | null;
}

export interface LicenseDetail extends LicenseRow {
  enterprise: { id: number; name: string; cnpj: string; email: string; phone: string } | null;
  invoices: Invoice[];
  events: AuditEvent[];
}

export interface Dashboard {
  counts: { total: number; trial: number; active: number; complimentary: number; grace: number; blocked: number; suspended: number };
  mrrCents: number;
  recentEvents: AuditEvent[];
}

export const KIND_LABEL: Record<LicenseKind, string> = {
  trial: 'Teste grátis',
  paid: 'Paga',
  complimentary: 'Cortesia',
  suspended: 'Suspensa',
  none: 'Sem licença',
};

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  TRIALING: 'Em teste',
  ACTIVE: 'Ativa',
  PAST_DUE: 'Pagamento pendente',
  CANCELED: 'Cancelada',
  EXPIRED: 'Expirada',
};

export const EVENT_LABEL: Record<string, string> = {
  'subscription.trial_started': 'Teste grátis iniciado',
  'subscription.plan_selected': 'Oficina escolheu um plano',
  'subscription.activated': 'Assinatura ativada',
  'subscription.renewed': 'Renovada',
  'subscription.past_due': 'Pagamento atrasado',
  'subscription.expired': 'Expirou',
  'subscription.cancel_scheduled': 'Cancelamento agendado',
  'subscription.resumed': 'Cancelamento desfeito',
  'subscription.canceled': 'Cancelada',
  'invoice.created': 'Fatura gerada',
  'invoice.paid': 'Fatura paga',
  'invoice.payment_failed': 'Pagamento recusado',
  'invoice.amount_mismatch': '⚠ Valor pago diferente da fatura',
  'invoice.voided': 'Fatura anulada',
  'license.created': 'Licença criada pelo admin',
  'license.complimentary_granted': 'Cortesia concedida',
  'license.complimentary_revoked': 'Cortesia encerrada',
  'license.plan_changed': 'Plano alterado pelo admin',
  'license.period_changed': 'Prazo alterado pelo admin',
  'license.suspended': 'Suspensa',
  'license.unsuspended': 'Suspensão removida',
  'license.note_changed': 'Anotação alterada',
  'license.invoice_marked_paid': 'Fatura marcada como paga pelo admin',
};

/** situação visível: o "tipo" da licença, mas bloqueio/tolerância ganham destaque */
export function badgeOf(row: LicenseRow): { cls: string; label: string } {
  if (row.kind === 'none') return { cls: 'none', label: KIND_LABEL.none };
  if (row.kind === 'suspended') return { cls: 'suspended', label: 'Suspensa' };
  if (row.access?.level === 'blocked') return { cls: 'blocked', label: 'Bloqueada' };
  if (row.access?.level === 'grace') return { cls: 'grace', label: 'Em tolerância' };
  return { cls: row.kind, label: KIND_LABEL[row.kind] };
}

export function money(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function isForever(iso: string | null | undefined): boolean {
  return !!iso && new Date(iso).getUTCFullYear() >= 2999;
}

// ── Módulos adicionais (contrato à parte da assinatura) ──
export interface ModuleContract {
  id: string;
  enterpriseId: number;
  module: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELED';
  startsAt: string;
  endsAt: string | null;
  priceCents: number | null;
  suspendedReason: string | null;
  adminNote: string | null;
}

export interface ModuleContractView {
  module: string;
  name: string;
  contract: ModuleContract | null;
  access: { module: string; active: boolean; until: string | null; reason: string };
  events: { id: number; type: string; payload: { actor?: string } | null; createdAt: string }[];
}

export interface ModuleContractSummary {
  enterpriseId: number;
  module: string;
  status: string;
  endsAt: string | null;
  active: boolean;
}

export const MODULE_NAME: Record<string, string> = { INVENTORY: 'Estoque' };

export const MODULE_EVENT_LABEL: Record<string, string> = {
  'module.contracted': 'Contrato criado',
  'module.updated': 'Contrato alterado',
  'module.reactivated': 'Contrato reativado',
  'module.suspended': 'Contrato suspenso',
  'module.unsuspended': 'Suspensão removida',
  'module.canceled': 'Contrato encerrado',
};
