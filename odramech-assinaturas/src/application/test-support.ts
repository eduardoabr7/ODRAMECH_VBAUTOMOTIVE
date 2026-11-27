import { FixedClock } from './clock';
import { SubscriptionService } from './subscription.service';
import { SubscriptionEventPublisher, SubscriptionChanged } from '../events/subscription-events';
import { SandboxProviderFactory, SANDBOX_SIGNATURE_HEADER, signSandboxBody } from '../payments/sandbox/sandbox.provider';
import {
  InMemoryInvoiceRepository, InMemoryPlanRepository, InMemorySubscriptionRepository,
} from '../repositories/in-memory.repositories';
import { Plan } from '../domain/model';
import { PaymentGateway } from '../payments/payment-provider';

// Montagem compartilhada pelos testes (repositórios em memória + sandbox + relógio controlado).
const plan = (id: number, code: string, priceCents: number, tier: number, maxEstablishments: number | null, features: string[] = []): Plan =>
  ({ id, code, name: code, interval: 'MONTHLY', priceCents, currency: 'BRL', description: null, active: true, sortOrder: tier, tier, maxEstablishments, features });

export const PLANS: Plan[] = [
  plan(1, 'BASIC', 22990, 1, 1),
  plan(2, 'INTERMEDIARIO', 42500, 2, 3, ['QUOTE_DOCUMENT_EDITOR']),
  plan(3, 'PRO', 79900, 3, 5, ['QUOTE_DOCUMENT_EDITOR']),
  plan(4, 'ULTRA', 239900, 4, null, ['QUOTE_DOCUMENT_EDITOR']),
];

export const SECRET = 'sandbox-test-webhook-secret';

/** webhook como o provedor mandaria: corpo cru + assinatura HMAC */
export function signedWebhook(body: object, secret = SECRET) {
  const raw = Buffer.from(JSON.stringify(body));
  return { headers: { [SANDBOX_SIGNATURE_HEADER]: signSandboxBody(secret, raw) }, body, raw };
}

/** assina o plano com cartão: no teste grátis já vira ATIVA na hora */
export async function activate(service: SubscriptionService, code: string) {
  await service.overview(1);
  const { openInvoice } = await service.selectPlan(1, code, 'CARD');
  return service.payInvoice(1, openInvoice!.id, 'CARD', { cardToken: 'tok_ok' });
}

export function setup(opts: { start?: Date; paymentsEnabled?: boolean; gateway?: PaymentGateway } = {}) {
  const clock = new FixedClock(opts.start ?? new Date('2026-01-10T12:00:00Z'));
  const subs = new InMemorySubscriptionRepository();
  const invoices = new InMemoryInvoiceRepository();
  const plans = new InMemoryPlanRepository(PLANS);
  const events: SubscriptionChanged[] = [];
  const publisher = new SubscriptionEventPublisher();
  publisher.attach({ onEvent: e => { events.push(e); } });
  const provider = new SandboxProviderFactory(SECRET);

  const service = new SubscriptionService(
    plans, subs, invoices,
    opts.gateway ?? provider.createGateway(), provider.createWebhookParser(), publisher, clock,
    { trialDays: 7, graceDays: 7, renewalLeadDays: 5, defaultPlanCode: 'INTERMEDIARIO', paymentsEnabled: opts.paymentsEnabled ?? true },
  );
  return { service, clock, subs, invoices, plans, events, publisher };
}

