import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Invoice } from '../../domain/model';
import {
  ChargeResult, ChargeStatus, GatewayEvent, InvalidWebhookSignature, PaymentGateway, PaymentProviderFactory, WebhookParser,
} from '../payment-provider';

/**
 * ADAPTER (sandbox) — implementa a porta PaymentGateway simulando um provedor real.
 * Nenhum dinheiro é movimentado. Serve para desenvolver e testar o fluxo completo.
 *
 * Regras do sandbox:
 *  - Pix e Boleto geram instruções e ficam PENDENTES até a confirmação (webhook assinado ou "Simular pagamento");
 *  - Cartão é aprovado na hora, exceto o token "tok_recusado" (simula recusa);
 *  - em produção o sandbox não processa pagamento nenhum (SubscriptionsConfig.paymentsEnabled).
 */
export class SandboxGateway implements PaymentGateway {
  readonly provider = 'sandbox';
  /** cobranças criadas nesta execução (um provedor real guarda isso do lado dele) */
  private readonly charges = new Map<string, { amountCents: number; currency: string; failed: boolean }>();

  private remember(ref: string, invoice: Invoice, failed = false) {
    this.charges.set(ref, { amountCents: invoice.amountCents, currency: 'BRL', failed });
  }

  async createPixCharge(invoice: Invoice): Promise<ChargeResult> {
    const ref = `pix_${randomUUID()}`;
    this.remember(ref, invoice);
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

  async chargeCard(invoice: Invoice, cardToken: string): Promise<ChargeResult> {
    const ref = `card_${randomUUID()}`;
    if (cardToken === 'tok_recusado') {
      this.remember(ref, invoice, true);
      return { status: 'failed', gatewayRef: ref, instructions: null, failureReason: 'Cartão recusado pelo emissor (simulação).' };
    }
    this.remember(ref, invoice);
    return { status: 'paid', gatewayRef: ref, instructions: { kind: 'CARD', note: 'Aprovado (sandbox).' } };
  }

  async issueBoleto(invoice: Invoice): Promise<ChargeResult> {
    const ref = `bol_${randomUUID()}`;
    this.remember(ref, invoice);
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

  /** no sandbox, toda cobrança conhecida e não recusada conta como paga quando consultada */
  async fetchCharge(gatewayRef: string): Promise<ChargeStatus | null> {
    const c = this.charges.get(gatewayRef);
    if (!c) return null;
    return { status: c.failed ? 'failed' : 'paid', amountCents: c.amountCents, currency: c.currency };
  }
}

export const SANDBOX_SIGNATURE_HEADER = 'x-sandbox-signature';

/** assina um corpo como o "provedor sandbox" faria (testes e quem simula o webhook à mão) */
export function signSandboxBody(secret: string, raw: string | Buffer): string {
  return createHmac('sha256', secret).update(raw).digest('hex');
}

/**
 * Parser do webhook do sandbox: { event: 'PAYMENT_CONFIRMED' | 'PAYMENT_FAILED', reference }.
 * Exige o header x-sandbox-signature = HMAC-SHA256(segredo, corpo cru), como um provedor real exigiria.
 */
export class SandboxWebhookParser implements WebhookParser {
  constructor(private readonly secret: string) {}

  parse(headers: Record<string, unknown>, body: any, rawBody: Buffer | undefined): GatewayEvent | null {
    const provided = String(headers[SANDBOX_SIGNATURE_HEADER] ?? '');
    const raw = rawBody ?? Buffer.from(JSON.stringify(body ?? {}));
    const a = Buffer.from(provided);
    const b = Buffer.from(signSandboxBody(this.secret, raw));
    if (!provided || a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new InvalidWebhookSignature('Assinatura do webhook inválida.');
    }

    if (!body?.reference || typeof body.reference !== 'string') return null;
    if (body.event === 'PAYMENT_CONFIRMED') return { type: 'payment.confirmed', gatewayRef: body.reference };
    if (body.event === 'PAYMENT_FAILED') return { type: 'payment.failed', gatewayRef: body.reference };
    return null;
  }
}

/** Família "sandbox" da ABSTRACT FACTORY. */
export class SandboxProviderFactory extends PaymentProviderFactory {
  readonly name = 'sandbox';
  constructor(private readonly webhookSecret = 'sandbox-dev-webhook-secret') { super(); }
  createGateway(): PaymentGateway { return new SandboxGateway(); }
  createWebhookParser(): WebhookParser { return new SandboxWebhookParser(this.webhookSecret); }
}
