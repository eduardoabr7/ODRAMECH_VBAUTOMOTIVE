import { SubscriptionsConfig } from './subscriptions-config';

describe('Simular pagamento', () => {
  it('liberado no sandbox fora de produção', () => {
    expect(SubscriptionsConfig.forTesting({ NODE_ENV: 'development' }).values.allowSimulatedPayments).toBe(true);
  });
  it('bloqueado em produção (daria plano pago de graça)', () => {
    expect(SubscriptionsConfig.forTesting({ NODE_ENV: 'production' }).values.allowSimulatedPayments).toBe(false);
  });
});
