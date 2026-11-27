import { SubscriptionsConfig } from './subscriptions-config';

const STRONG = { API_KEY: 'k'.repeat(40), SANDBOX_WEBHOOK_SECRET: 's'.repeat(40) };

describe('Simular pagamento', () => {
  it('liberado no sandbox fora de produção', () => {
    expect(SubscriptionsConfig.forTesting({ NODE_ENV: 'development' }).values.allowSimulatedPayments).toBe(true);
  });
  it('bloqueado em produção (daria plano pago de graça)', () => {
    expect(SubscriptionsConfig.forTesting({ NODE_ENV: 'production', ...STRONG }).values.allowSimulatedPayments).toBe(false);
  });
  it('sandbox em produção não processa pagamento nenhum', () => {
    expect(SubscriptionsConfig.forTesting({ NODE_ENV: 'production', ...STRONG }).values.paymentsEnabled).toBe(false);
    expect(SubscriptionsConfig.forTesting({ NODE_ENV: 'development' }).values.paymentsEnabled).toBe(true);
  });
  it('produção recusa subir com chaves de exemplo ou curtas', () => {
    expect(() => SubscriptionsConfig.forTesting({ NODE_ENV: 'production', API_KEY: 'dev-odramech-subscriptions-key' })).toThrow('produção');
    expect(() => SubscriptionsConfig.forTesting({ NODE_ENV: 'production', API_KEY: 'k'.repeat(40) })).toThrow('produção');
  });
});
