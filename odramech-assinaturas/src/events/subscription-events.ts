import { Logger } from '@nestjs/common';
import { SubscriptionStatus } from '../domain/model';

/** Evento único com tipo discriminado — fácil de serializar para o webhook. */
export interface SubscriptionChanged {
  type:
    | 'subscription.trial_started'
    | 'subscription.plan_selected'
    | 'subscription.activated'
    | 'subscription.renewed'
    | 'subscription.past_due'
    | 'subscription.expired'
    | 'subscription.cancel_scheduled'
    | 'subscription.resumed'
    | 'subscription.canceled'
    | 'invoice.created'
    | 'invoice.paid'
    | 'invoice.payment_failed'
    | 'invoice.amount_mismatch'
    | 'invoice.voided'
    // ações do administrador no painel
    | 'license.created'
    | 'license.complimentary_granted'
    | 'license.complimentary_revoked'
    | 'license.plan_changed'
    | 'license.period_changed'
    | 'license.suspended'
    | 'license.unsuspended'
    | 'license.note_changed'
    | 'license.invoice_marked_paid';
  subscriptionId: string;
  enterpriseId: number;
  status: SubscriptionStatus;
  data?: Record<string, unknown>;
  /** quem fez: "admin:<id> <e-mail>" nas ações do painel; ausente = sistema/oficina */
  actor?: string;
  occurredAt: string;
}

export interface SubscriptionObserver {
  onEvent(event: SubscriptionChanged): Promise<void> | void;
}

/**
 * OBSERVER (sujeito) — avisa todos os observadores registrados.
 * Hoje: auditoria no banco e webhook para o backend da oficina.
 * Amanhã: e‑mail de cobrança, métricas… sem mudar quem publica.
 */
export class SubscriptionEventPublisher {
  private readonly logger = new Logger('SubscriptionEvents');
  private readonly observers: SubscriptionObserver[] = [];

  attach(observer: SubscriptionObserver): void {
    this.observers.push(observer);
  }

  async publish(event: Omit<SubscriptionChanged, 'occurredAt'>): Promise<void> {
    const full: SubscriptionChanged = { ...event, occurredAt: new Date().toISOString() };
    await Promise.all(this.observers.map(async o => {
      try {
        await o.onEvent(full);
      } catch (err) {
        this.logger.warn(`${o.constructor.name} falhou em ${event.type}: ${(err as Error).message}`);
      }
    }));
  }
}
