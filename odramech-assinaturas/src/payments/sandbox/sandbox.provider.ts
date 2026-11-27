import { createHash, randomUUID } from 'node:crypto';
import { Invoice } from '../../domain/model';
import { ChargeResult, GatewayEvent, PaymentGateway, PaymentProviderFactory, WebhookParser } from '../payment-provider';

/**
 * ADAPTER (sandbox) — implementa a porta PaymentGateway simulando um provedor real.
 * Nenhum dinheiro é movimentado. Serve para desenvolver e testar o fluxo completo.
 *
 * Regras do sandbox:
 *  - Pix e Boleto geram instruções e ficam PENDENTES até a confirmação (webhook simulado);
 *  - Cartão é aprovado na hora, exceto o token "tok_recusado" (simula recusa).
 */
export class SandboxGateway implements PaymentGateway {
  readonly provider = 'sandbox';

  async createPixCharge(invoice: Invoice): Promise<ChargeResult> {
    const ref = `pix_${randomUUID()}`;
    const hash = createHash('sha256').update(ref).digest('hex').slice(0, 32).toUpperCase();
    return {
      status: 'pending',
      gatewayRef: ref,
      instructions: {
        kind: 'PIX',
        // formato ilustrativo (não é um BR Code válido — sandbox)
        pixCode: `00020126SANDBOX.ODRAMECH${hash}5204000053039865406${(invoice.amountCents / 100).toFixed(2)}5802BR6009SAOPAULO`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        note: 'Ambiente sandbox: use "Simular pagamento" para confirmar.',
      },
    };
  }

  async chargeCard(_invoice: Invoice, cardToken: string): Promise<ChargeResult> {
    const ref = `card_${randomUUID()}`;
    if (cardToken === 'tok_recusado') {
      return { status: 'failed', gatewayRef: ref, instructions: null, failureReason: 'Cartão recusado pelo emissor (simulação).' };
    }
    return { status: 'paid', gatewayRef: ref, instructions: { kind: 'CARD', note: 'Aprovado (sandbox).' } };
  }

  async issueBoleto(invoice: Invoice): Promise<ChargeResult> {
    const ref = `bol_${randomUUID()}`;
    const digits = createHash('sha256').update(ref).digest('hex').replace(/[a-f]/g, '').padEnd(47, '0').slice(0, 47);
    return {
      status: 'pending',
      gatewayRef: ref,
      instructions: {
        kind: 'BOLETO',
        boletoLine: `${digits.slice(0, 5)}.${digits.slice(5, 10)} ${digits.slice(10, 15)}.${digits.slice(15, 21)} ${digits.slice(21, 26)}.${digits.slice(26, 32)} ${digits.slice(32, 33)} ${digits.slice(33)}`,
        expiresAt: invoice.dueDate.toISOString(),
        note: 'Ambiente sandbox: use "Simular pagamento" para confirmar.',
      },
    };
  }
}

/** Parser do webhook do sandbox: { event: 'PAYMENT_CONFIRMED' | 'PAYMENT_FAILED', reference } */
export class SandboxWebhookParser implements WebhookParser {
  parse(_headers: Record<string, unknown>, body: any): GatewayEvent | null {
    if (!body?.reference || typeof body.reference !== 'string') return null;
    if (body.event === 'PAYMENT_CONFIRMED') return { type: 'payment.confirmed', gatewayRef: body.reference };
    if (body.event === 'PAYMENT_FAILED') return { type: 'payment.failed', gatewayRef: body.reference };
    return null;
  }
}

/** Família "sandbox" da ABSTRACT FACTORY. */
export class SandboxProviderFactory extends PaymentProviderFactory {
  readonly name = 'sandbox';
  createGateway(): PaymentGateway { return new SandboxGateway(); }
  createWebhookParser(): WebhookParser { return new SandboxWebhookParser(); }
}
