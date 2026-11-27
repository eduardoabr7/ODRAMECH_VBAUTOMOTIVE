import { Invoice, PaymentInstructions } from '../domain/model';

/** Resultado normalizado de uma cobrança, qualquer que seja o provedor. */
export interface ChargeResult {
  status: 'paid' | 'pending' | 'failed';
  gatewayRef: string;
  instructions: PaymentInstructions | null;
  failureReason?: string;
}

/** Evento de webhook já traduzido para o vocabulário do sistema. */
export interface GatewayEvent {
  type: 'payment.confirmed' | 'payment.failed';
  gatewayRef: string;
}

/**
 * Porta do gateway — o que o sistema precisa de QUALQUER provedor de pagamento.
 * Cada provedor real (Mercado Pago, Asaas, Stripe…) entra como um ADAPTER desta interface.
 */
export interface PaymentGateway {
  readonly provider: string;
  createPixCharge(invoice: Invoice): Promise<ChargeResult>;
  chargeCard(invoice: Invoice, cardToken: string): Promise<ChargeResult>;
  issueBoleto(invoice: Invoice): Promise<ChargeResult>;
}

export interface WebhookParser {
  /** valida assinatura/origem e traduz o payload do provedor; null = evento ignorado */
  parse(headers: Record<string, unknown>, body: unknown): GatewayEvent | null;
}

/**
 * ABSTRACT FACTORY — cria a FAMÍLIA de objetos de um provedor de pagamento.
 * Gateway e parser de webhook precisam ser do mesmo provedor; a fábrica garante
 * que nunca se misture o gateway de um com o parser de outro.
 */
export abstract class PaymentProviderFactory {
  abstract readonly name: string;
  abstract createGateway(): PaymentGateway;
  abstract createWebhookParser(): WebhookParser;
}
