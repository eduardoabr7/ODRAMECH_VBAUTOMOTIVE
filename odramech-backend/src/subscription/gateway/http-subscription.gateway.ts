import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AccessDecision, PaymentMethod, SubscriptionGateway } from './subscription.gateway';

/** Falha de rede/timeout — distinta de um erro de negócio (4xx) vindo do serviço. */
export class SubscriptionServiceUnavailable extends Error {}

/**
 * ADAPTER — traduz a porta SubscriptionGateway para a API REST do serviço de assinaturas
 * (rotas, header x-api-key, JSON, códigos HTTP). Erros 4xx do serviço viram HttpException
 * com a mesma mensagem; falhas de rede viram SubscriptionServiceUnavailable.
 */
export class HttpSubscriptionGateway extends SubscriptionGateway {
  private readonly logger = new Logger('SubscriptionsHttp');

  constructor(private readonly baseUrl: string, private readonly apiKey: string, private readonly timeoutMs = 4000) {
    super();
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { 'x-api-key': this.apiKey, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } catch (err) {
      throw new SubscriptionServiceUnavailable((err as Error).message);
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (res.status >= 500) throw new SubscriptionServiceUnavailable(`HTTP ${res.status}`);
    if (!res.ok) {
      this.logger.debug(`${method} ${path} → ${res.status}`);
      throw new HttpException(data?.message ?? 'Erro no serviço de assinaturas.', res.status as HttpStatus);
    }
    return data as T;
  }

  private base(enterpriseId: number) {
    return `/enterprises/${enterpriseId}/subscription`;
  }

  access(enterpriseId: number) {
    return this.call<AccessDecision>('GET', `${this.base(enterpriseId)}/access`);
  }

  overview(enterpriseId: number, enterpriseName?: string) {
    const qs = enterpriseName ? `?enterpriseName=${encodeURIComponent(enterpriseName)}` : '';
    return this.call<any>('GET', `${this.base(enterpriseId)}${qs}`);
  }

  plans() {
    return this.call<any[]>('GET', '/plans');
  }

  selectPlan(enterpriseId: number, planCode: string, method: PaymentMethod) {
    return this.call<any>('POST', `${this.base(enterpriseId)}/plan`, { planCode, method });
  }

  payInvoice(enterpriseId: number, invoiceId: string, method: PaymentMethod, cardToken?: string) {
    return this.call<any>('POST', `${this.base(enterpriseId)}/invoices/${encodeURIComponent(invoiceId)}/pay`, { method, cardToken });
  }

  simulatePayment(enterpriseId: number, invoiceId: string) {
    return this.call<any>('POST', `${this.base(enterpriseId)}/invoices/${encodeURIComponent(invoiceId)}/simulate-payment`, {});
  }

  cancel(enterpriseId: number) {
    return this.call<any>('POST', `${this.base(enterpriseId)}/cancel`, {});
  }

  resume(enterpriseId: number) {
    return this.call<any>('POST', `${this.base(enterpriseId)}/resume`, {});
  }

  invalidate(): void { /* sem estado */ }
}
