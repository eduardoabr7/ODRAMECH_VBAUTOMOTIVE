import { DAY_MS, Subscription, SubscriptionStatus } from './model';

export type AccessLevel = 'full' | 'grace' | 'blocked';

export interface AccessDecision {
  level: AccessLevel;
  /** quando o acesso deixa de ser pleno (fim do teste/período/tolerância) */
  until: Date | null;
  reason: string;
}

/**
 * Regra única de "esta empresa pode usar o sistema?". O backend da oficina consome
 * a decisão pronta e não reimplementa regra de cobrança.
 */
export function decideAccess(sub: Subscription | null, graceDays: number, now: Date): AccessDecision {
  if (!sub) return { level: 'full', until: null, reason: 'Sem assinatura (primeiro acesso).' };

  const graceEnd = new Date(sub.currentPeriodEnd.getTime() + graceDays * DAY_MS);
  const byStatus: Record<SubscriptionStatus, () => AccessDecision> = {
    TRIALING: () => ({ level: 'full', until: sub.currentPeriodEnd, reason: 'Período de teste.' }),
    ACTIVE: () => ({ level: 'full', until: sub.currentPeriodEnd, reason: 'Assinatura ativa.' }),
    PAST_DUE: () => now < graceEnd
      ? { level: 'grace', until: graceEnd, reason: 'Pagamento pendente — em tolerância.' }
      : { level: 'blocked', until: null, reason: 'Pagamento pendente além da tolerância.' },
    CANCELED: () => now < sub.currentPeriodEnd
      ? { level: 'full', until: sub.currentPeriodEnd, reason: 'Cancelada — acesso até o fim do período pago.' }
      : { level: 'blocked', until: null, reason: 'Assinatura cancelada.' },
    EXPIRED: () => ({ level: 'blocked', until: null, reason: 'Assinatura expirada.' }),
  };
  return byStatus[sub.status]();
}
