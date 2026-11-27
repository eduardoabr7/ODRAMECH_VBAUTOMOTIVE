import { BadRequestException } from '@nestjs/common';
import { Invoice, PaymentMethod } from '../domain/model';
import { ChargeResult, PaymentGateway } from './payment-provider';

export interface PayRequest {
  /** token do cartão gerado pelo SDK do provedor no navegador — o sistema nunca vê o número */
  cardToken?: string;
}

/**
 * STRATEGY — cada forma de pagamento sabe como cobrar uma fatura.
 * O serviço só faz `strategyFor(method).pay(invoice, gateway, req)`.
 */
export interface PaymentMethodStrategy {
  readonly method: PaymentMethod;
  readonly label: string;
  pay(invoice: Invoice, gateway: PaymentGateway, req: PayRequest): Promise<ChargeResult>;
}

class PixStrategy implements PaymentMethodStrategy {
  readonly method = 'PIX' as const;
  readonly label = 'Pix';
  pay(invoice: Invoice, gateway: PaymentGateway) {
    return gateway.createPixCharge(invoice);
  }
}

class CardStrategy implements PaymentMethodStrategy {
  readonly method = 'CARD' as const;
  readonly label = 'Cartão de crédito';
  pay(invoice: Invoice, gateway: PaymentGateway, req: PayRequest) {
    if (!req.cardToken) throw new BadRequestException('Token do cartão é obrigatório.');
    return gateway.chargeCard(invoice, req.cardToken);
  }
}

class BoletoStrategy implements PaymentMethodStrategy {
  readonly method = 'BOLETO' as const;
  readonly label = 'Boleto';
  pay(invoice: Invoice, gateway: PaymentGateway) {
    return gateway.issueBoleto(invoice);
  }
}

const STRATEGIES: Record<PaymentMethod, PaymentMethodStrategy> = {
  PIX: new PixStrategy(),
  CARD: new CardStrategy(),
  BOLETO: new BoletoStrategy(),
};

export function paymentStrategyFor(method: PaymentMethod): PaymentMethodStrategy {
  const s = STRATEGIES[method];
  if (!s) throw new BadRequestException(`Forma de pagamento não suportada: ${method}`);
  return s;
}

export const PAYMENT_METHODS = Object.values(STRATEGIES).map(s => ({ method: s.method, label: s.label }));
