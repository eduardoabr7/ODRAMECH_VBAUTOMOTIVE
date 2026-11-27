import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { AccessDecision, PaymentMethod, SubscriptionGateway } from './subscription.gateway';
import { SubscriptionServiceUnavailable } from './http-subscription.gateway';

/**
 * PROXY — controla o ACESSO ao serviço remoto com um circuit breaker.
 *
 * Mesma interface do objeto real, mas decide se a chamada deve acontecer:
 *  - após N falhas seguidas, o circuito ABRE e para de chamar por um tempo (protege
 *    a oficina de ficar lenta esperando timeouts);
 *  - com o circuito aberto, `access()` responde "falha aberta" (a oficina continua
 *    trabalhando — cobrança fora do ar nunca pode parar o atendimento) e as demais
 *    operações respondem 503 com mensagem clara.
 */
export class ResilientSubscriptionProxy extends SubscriptionGateway {
  private readonly logger = new Logger('SubscriptionsBreaker');
  private failures = 0;
  private openUntil = 0;

  constructor(
    private readonly real: SubscriptionGateway,
    private readonly failureThreshold = 3,
    private readonly cooldownMs = 30_000,
  ) {
    super();
  }

  private get isOpen(): boolean {
    return Date.now() < this.openUntil;
  }

  private async guard<T>(op: () => Promise<T>): Promise<T> {
    if (this.isOpen) throw new SubscriptionServiceUnavailable('circuito aberto');
    try {
      const result = await op();
      if (this.failures) this.logger.log('Serviço de assinaturas respondeu novamente — circuito fechado.');
      this.failures = 0;
      return result;
    } catch (err) {
      if (err instanceof SubscriptionServiceUnavailable) {
        this.failures++;
        if (this.failures >= this.failureThreshold) {
          this.openUntil = Date.now() + this.cooldownMs;
          this.logger.warn(`Serviço de assinaturas indisponível — circuito aberto por ${this.cooldownMs / 1000}s.`);
        }
      }
      throw err;
    }
  }

  /** para operações do usuário: indisponibilidade vira 503 legível */
  private async userOp<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await this.guard(op);
    } catch (err) {
      if (err instanceof SubscriptionServiceUnavailable) {
        throw new ServiceUnavailableException('O serviço de assinaturas está temporariamente indisponível. Tente novamente em instantes.');
      }
      throw err;
    }
  }

  async access(enterpriseId: number): Promise<AccessDecision> {
    try {
      return await this.guard(() => this.real.access(enterpriseId));
    } catch (err) {
      if (err instanceof SubscriptionServiceUnavailable) {
        return { status: 'UNKNOWN', level: 'full', until: null, reason: 'Serviço de assinaturas indisponível.', degraded: true };
      }
      throw err;
    }
  }

  overview(id: number, name?: string) { return this.userOp(() => this.real.overview(id, name)); }
  plans() { return this.userOp(() => this.real.plans()); }
  selectPlan(id: number, plan: string, m: PaymentMethod) { return this.userOp(() => this.real.selectPlan(id, plan, m)); }
  payInvoice(id: number, inv: string, m: PaymentMethod, tok?: string) { return this.userOp(() => this.real.payInvoice(id, inv, m, tok)); }
  simulatePayment(id: number, inv: string) { return this.userOp(() => this.real.simulatePayment(id, inv)); }
  cancel(id: number) { return this.userOp(() => this.real.cancel(id)); }
  resume(id: number) { return this.userOp(() => this.real.resume(id)); }
  invalidate(id: number) { this.real.invalidate(id); }
}
