import { ServiceUnavailableException } from '@nestjs/common';
import { AccessDecision, SubscriptionGateway } from './gateway/subscription.gateway';
import { CachingSubscriptionGateway } from './gateway/caching-subscription.gateway';
import { ResilientSubscriptionProxy } from './gateway/resilient-subscription.proxy';
import { SubscriptionServiceUnavailable } from './gateway/http-subscription.gateway';

/** gateway "real" falso, com contador de chamadas e chave para simular queda */
class FakeRemote extends SubscriptionGateway {
  calls = 0;
  down = false;
  level: AccessDecision['level'] = 'full';
  private hit<T>(v: T): Promise<T> {
    this.calls++;
    return this.down ? Promise.reject(new SubscriptionServiceUnavailable('down')) : Promise.resolve(v);
  }
  access() { return this.hit({ status: 'ACTIVE', level: this.level, until: null, reason: 'ok' }); }
  overview() { return this.hit({}); }
  plans() { return this.hit([]); }
  selectPlan() { return this.hit({}); }
  payInvoice() { return this.hit({}); }
  simulatePayment() { return this.hit({}); }
  cancel() { return this.hit({}); }
  resume() { return this.hit({}); }
  invalidate() {}
}

describe('CachingSubscriptionGateway (Decorator)', () => {
  it('cacheia a decisão e invalida ao mudar a assinatura', async () => {
    const remote = new FakeRemote();
    const gw = new CachingSubscriptionGateway(remote, 60_000);

    await gw.access(1);
    await gw.access(1);
    expect(remote.calls).toBe(1);

    await gw.cancel(1); // mutação limpa o cache
    remote.level = 'blocked';
    expect((await gw.access(1)).level).toBe('blocked');
    expect(remote.calls).toBe(3);
  });
});

describe('ResilientSubscriptionProxy (Proxy / circuit breaker)', () => {
  it('serviço fora: acesso em "falha aberta" e circuito abre após 3 falhas', async () => {
    const remote = new FakeRemote();
    remote.down = true;
    const proxy = new ResilientSubscriptionProxy(remote, 3, 60_000);

    for (let i = 0; i < 3; i++) {
      const d = await proxy.access(1);
      expect(d.level).toBe('full');
      expect(d.degraded).toBe(true);
    }
    expect(remote.calls).toBe(3);

    await proxy.access(1); // circuito aberto: nem chama o remoto
    expect(remote.calls).toBe(3);
    await expect(proxy.overview(1)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('decisão degradada não fica em cache (volta assim que o serviço volta)', async () => {
    const remote = new FakeRemote();
    remote.down = true;
    const gw = new CachingSubscriptionGateway(new ResilientSubscriptionProxy(remote, 99, 0), 60_000);
    expect((await gw.access(1)).degraded).toBe(true);

    remote.down = false;
    remote.level = 'blocked';
    expect((await gw.access(1)).level).toBe('blocked');
  });
});
