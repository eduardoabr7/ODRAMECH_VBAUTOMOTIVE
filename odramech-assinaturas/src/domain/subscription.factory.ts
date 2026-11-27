import { DAY_MS, NewSubscription, Plan } from './model';

/**
 * FACTORY — cria assinaturas em estados iniciais válidos.
 * Garante que nenhuma assinatura nasça com datas incoerentes (ex.: período sem fim).
 */
export class SubscriptionFactory {
  /** período de teste gratuito — o primeiro estado de toda empresa */
  static trial(enterpriseId: number, enterpriseName: string | null, plan: Plan, trialDays: number, now: Date): NewSubscription {
    const trialEndsAt = new Date(now.getTime() + trialDays * DAY_MS);
    return {
      enterpriseId,
      enterpriseName,
      planId: plan.id,
      status: 'TRIALING',
      paymentMethod: null,
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    };
  }
}
