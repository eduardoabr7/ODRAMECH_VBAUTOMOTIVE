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
 * Situação de uma cobrança consultada DIRETO na API do provedor.
 * O webhook só avisa "algo mudou"; quem decide se foi pago (e quanto) é esta consulta —
 * assim um webhook forjado nunca libera nada.
 */
export interface ChargeStatus {
  status: 'paid' | 'pending' | 'failed';
  amountCents: number;
  currency: string;
}

/** Assinatura do webhook não confere — quem chamou não é o provedor. */
export class InvalidWebhookSignature extends Error {}

/**
 * Porta do gateway — o que o sistema precisa de QUALQUER provedor de pagamento.
 * Cada provedor real (Mercado Pago, Asaas, Stripe…) entra como um ADAPTER desta interface.
 */
export interface PaymentGateway {
  readonly provider: string;
  createPixCharge(invoice: Invoice): Promise<ChargeResult>;
  chargeCard(invoice: Invoice, cardToken: string): Promise<ChargeResult>;
  issueBoleto(invoice: Invoice): Promise<ChargeResult>;
  /** consulta a cobrança no provedor; null = o provedor não conhece essa referência */
  fetchCharge(gatewayRef: string): Promise<ChargeStatus | null>;
}

export interface WebhookParser {
  /**
   * Valida a assinatura do provedor sobre o corpo CRU (os bytes exatos recebidos) e traduz o payload.
   * Assinatura ausente/errada → lança InvalidWebhookSignature. null = evento que não nos interessa.
   */
  parse(headers: Record<string, unknown>, body: unknown, rawBody: Buffer | undefined): GatewayEvent | null;
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
