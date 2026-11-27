import { AccessDecision, PaymentMethod, SubscriptionGateway } from './subscription.gateway';

interface Entry {
  value: AccessDecision;
  expiresAt: number;
}

/**
 * DECORATOR — acrescenta cache à consulta de acesso sem alterar o gateway decorado.
 *
 * `access()` é chamado em TODA requisição de escrita (guard). Sem cache, cada clique na
 * oficina viraria uma chamada HTTP ao serviço de assinaturas. Aqui a decisão fica em
 * memória por alguns segundos e é descartada quando:
 *  - a própria oficina altera a assinatura (escolher plano, pagar, cancelar…);
 *  - o serviço de assinaturas avisa por webhook (invalidate).
 * Decisões "degradadas" (serviço fora) não são cacheadas.
 */
export class CachingSubscriptionGateway extends SubscriptionGateway {
  private readonly cache = new Map<number, Entry>();

  constructor(private readonly inner: SubscriptionGateway, private readonly ttlMs: number) {
    super();
  }

  async access(enterpriseId: number): Promise<AccessDecision> {
    const hit = this.cache.get(enterpriseId);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const value = await this.inner.access(enterpriseId);
    if (!value.degraded && this.ttlMs > 0) this.cache.set(enterpriseId, { value, expiresAt: Date.now() + this.ttlMs });
    return value;
  }

  /** operações que mudam a assinatura limpam o cache da empresa */
  private async mutate<T>(enterpriseId: number, op: () => Promise<T>): Promise<T> {
    try {
      return await op();
    } finally {
      this.invalidate(enterpriseId);
    }
  }

  overview(id: number, name?: string) { return this.inner.overview(id, name); }
  plans() { return this.inner.plans(); }
  selectPlan(id: number, plan: string, m: PaymentMethod) { return this.mutate(id, () => this.inner.selectPlan(id, plan, m)); }
  payInvoice(id: number, inv: string, m: PaymentMethod, tok?: string) { return this.mutate(id, () => this.inner.payInvoice(id, inv, m, tok)); }
  simulatePayment(id: number, inv: string) { return this.mutate(id, () => this.inner.simulatePayment(id, inv)); }
  cancel(id: number) { return this.mutate(id, () => this.inner.cancel(id)); }
  resume(id: number) { return this.mutate(id, () => this.inner.resume(id)); }

  invalidate(enterpriseId: number): void {
    this.cache.delete(enterpriseId);
    this.inner.invalidate(enterpriseId);
  }
}
