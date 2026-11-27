import { Logger } from '@nestjs/common';
import { EventLogRepository } from '../repositories/repositories';
import { SubscriptionChanged, SubscriptionObserver } from './subscription-events';

/** Grava cada evento na trilha de auditoria (tabela subscription_events). */
export class AuditTrailObserver implements SubscriptionObserver {
  constructor(private readonly log: EventLogRepository) {}
  onEvent(e: SubscriptionChanged) {
    return this.log.append(e.subscriptionId, e.type, { status: e.status, ...e.data });
  }
}

/**
 * Avisa o backend da oficina para invalidar o cache de status da assinatura.
 * Melhor esforço: se o backend estiver fora, o cache dele expira sozinho (TTL).
 */
export class MainBackendWebhookObserver implements SubscriptionObserver {
  private readonly logger = new Logger('Webhook');
  constructor(private readonly url: string | null, private readonly apiKey: string) {}

  async onEvent(e: SubscriptionChanged) {
    if (!this.url) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
        body: JSON.stringify(e),
        signal: ctrl.signal,
      });
      if (!res.ok) this.logger.warn(`Backend respondeu ${res.status} para ${e.type}`);
    } catch {
      this.logger.debug(`Backend indisponível para ${e.type} (ok, o cache dele expira sozinho)`);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Log legível no console — útil em desenvolvimento. */
export class ConsoleObserver implements SubscriptionObserver {
  private readonly logger = new Logger('Assinaturas');
  onEvent(e: SubscriptionChanged) {
    this.logger.log(`empresa ${e.enterpriseId} · ${e.type} · ${e.status}`);
  }
}
