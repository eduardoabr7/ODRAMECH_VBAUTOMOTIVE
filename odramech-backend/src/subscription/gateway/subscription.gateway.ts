/**
 * Porta para o serviço externo "Gerenciamento de Assinaturas Odramech".
 * O backend da oficina depende só desta abstração (Dependency Inversion);
 * a implementação concreta é uma cadeia Adapter → Proxy → Decorator montada no módulo.
 */

export type AccessLevel = 'full' | 'grace' | 'blocked';

export interface AccessDecision {
  status: string;
  level: AccessLevel;
  until: string | null;
  reason: string;
  /** true quando o serviço de assinaturas está fora e a decisão é "falha aberta" */
  degraded?: boolean;
}

export type PaymentMethod = 'PIX' | 'CARD' | 'BOLETO';

export abstract class SubscriptionGateway {
  abstract access(enterpriseId: number): Promise<AccessDecision>;
  abstract overview(enterpriseId: number, enterpriseName?: string): Promise<any>;
  abstract plans(): Promise<any[]>;
  abstract selectPlan(enterpriseId: number, planCode: string, method: PaymentMethod): Promise<any>;
  abstract payInvoice(enterpriseId: number, invoiceId: string, method: PaymentMethod, cardToken?: string): Promise<any>;
  abstract simulatePayment(enterpriseId: number, invoiceId: string): Promise<any>;
  abstract cancel(enterpriseId: number): Promise<any>;
  abstract resume(enterpriseId: number): Promise<any>;
  /** avisos do serviço (webhook) → descartar o que houver em cache */
  abstract invalidate(enterpriseId: number): void;
}
