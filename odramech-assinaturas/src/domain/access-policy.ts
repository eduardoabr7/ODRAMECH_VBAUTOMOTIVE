import { complimentaryActive, DAY_MS, Subscription, SubscriptionStatus } from './model';

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
 *
 * A decisão olha as DATAS, não só o status: um teste vencido bloqueia no mesmo instante,
 * sem depender do agendador já ter rodado.
 *
 * Ordem de precedência:
 *   1. suspensa pelo administrador → bloqueada (nada passa por cima)
 *   2. cortesia vigente            → liberada
 *   3. regras do status de cobrança
 */
export function decideAccess(sub: Subscription | null, graceDays: number, now: Date): AccessDecision {
  if (!sub) return { level: 'full', until: null, reason: 'Sem assinatura (primeiro acesso).' };

  if (sub.suspended) {
    return { level: 'blocked', until: null, reason: sub.suspendedReason ? `Licença suspensa: ${sub.suspendedReason}` : 'Licença suspensa pelo administrador.' };
  }
  if (sub.complimentary) {
    // cortesia não tem tolerância: venceu, bloqueia
    return complimentaryActive(sub, now)
      ? { level: 'full', until: sub.complimentaryUntil, reason: 'Licença cortesia.' }
      : { level: 'blocked', until: null, reason: 'Licença cortesia encerrada.' };
  }

  const ended = now >= sub.currentPeriodEnd;
  const graceEnd = new Date(sub.currentPeriodEnd.getTime() + graceDays * DAY_MS);
  const pastDue = (): AccessDecision => now < graceEnd
    ? { level: 'grace', until: graceEnd, reason: 'Pagamento pendente — em tolerância.' }
    : { level: 'blocked', until: null, reason: 'Pagamento pendente além da tolerância.' };

  const byStatus: Record<SubscriptionStatus, () => AccessDecision> = {
    // teste grátis não tem tolerância: acabou, bloqueia
    TRIALING: () => ended
      ? { level: 'blocked', until: null, reason: 'Período de teste encerrado.' }
      : { level: 'full', until: sub.currentPeriodEnd, reason: 'Período de teste.' },
    ACTIVE: () => ended ? pastDue() : { level: 'full', until: sub.currentPeriodEnd, reason: 'Assinatura ativa.' },
    PAST_DUE: pastDue,
    CANCELED: () => !ended
      ? { level: 'full', until: sub.currentPeriodEnd, reason: 'Cancelada — acesso até o fim do período pago.' }
      : { level: 'blocked', until: null, reason: 'Assinatura cancelada.' },
    EXPIRED: () => ({ level: 'blocked', until: null, reason: sub.complimentary ? 'Licença cortesia encerrada.' : 'Assinatura expirada.' }),
  };
  return byStatus[sub.status]();
}
