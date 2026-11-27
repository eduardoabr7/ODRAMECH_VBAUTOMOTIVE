import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessDecision, SubscriptionGateway } from './gateway/subscription.gateway';
import { ResilientSubscriptionProxy } from './gateway/resilient-subscription.proxy';
import { SubscriptionServiceUnavailable } from './gateway/http-subscription.gateway';
import { LastKnownAccessStore } from './gateway/last-known-access.store';
import { SubscriptionAccessGuard } from './subscription-access.guard';
import { AllowWhenBlocked } from './allow-when-blocked.decorator';
import { AppConfig } from 'src/core/config/app-config';

class FakeRemote extends SubscriptionGateway {
  down = false;
  level: AccessDecision['level'] = 'full';
  access(): Promise<AccessDecision> {
    if (this.down) return Promise.reject(new SubscriptionServiceUnavailable('down'));
    return Promise.resolve({ status: this.level === 'blocked' ? 'EXPIRED' : 'ACTIVE', level: this.level, until: null, reason: this.level === 'blocked' ? 'Período de teste encerrado.' : 'ok' });
  }
  overview() { return Promise.resolve({}); }
  plans() { return Promise.resolve([]); }
  selectPlan() { return Promise.resolve({}); }
  payInvoice() { return Promise.resolve({}); }
  simulatePayment() { return Promise.resolve({}); }
  cancel() { return Promise.resolve({}); }
  resume() { return Promise.resolve({}); }
  invalidate() {}
}

// controllers de mentira só para ler os metadados dos handlers
class Routes {
  @AllowWhenBlocked() listWorkOrders() {}
  exportSpreadsheet() {}
  quoteDocument() {}
  createWorkOrder() {}
}

function ctx(method: string, path: string, handler: keyof Routes): ExecutionContext {
  const req = { method, path, authContext: { enterpriseId: 7, context: 'AUTH', sub: 1 } };
  const res = { setHeader: () => undefined };
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    getHandler: () => Routes.prototype[handler],
    getClass: () => Routes,
  } as unknown as ExecutionContext;
}

const config = (enforcement: 'off' | 'warn' | 'block') => ({ values: { subscriptions: { enforcement } } }) as unknown as AppConfig;

describe('SubscriptionAccessGuard — modo somente leitura', () => {
  const remote = new FakeRemote();
  const guard = new SubscriptionAccessGuard(remote, config('block'), new Reflector());

  beforeEach(() => { remote.level = 'blocked'; remote.down = false; });

  it('consulta marcada continua funcionando', async () => {
    await expect(guard.canActivate(ctx('GET', '/workorder', 'listWorkOrders'))).resolves.toBe(true);
  });

  it('BRECHA: exportação (GET) é bloqueada com 402', async () => {
    await expect(guard.canActivate(ctx('GET', '/export/work-orders', 'exportSpreadsheet'))).rejects.toMatchObject({ status: 402 });
  });

  it('BRECHA: documento/impressão do orçamento (GET) é bloqueado', async () => {
    await expect(guard.canActivate(ctx('GET', '/quote/1/document', 'quoteDocument'))).rejects.toBeInstanceOf(HttpException);
  });

  it('escrita é bloqueada', async () => {
    await expect(guard.canActivate(ctx('POST', '/workorder', 'createWorkOrder'))).rejects.toMatchObject({ status: 402 });
  });

  it('telas de assinatura e login sempre passam (para regularizar)', async () => {
    await expect(guard.canActivate(ctx('POST', '/subscription/plan', 'createWorkOrder'))).resolves.toBe(true);
    await expect(guard.canActivate(ctx('POST', '/auth/logout', 'createWorkOrder'))).resolves.toBe(true);
  });

  it('com assinatura em dia tudo passa', async () => {
    remote.level = 'full';
    await expect(guard.canActivate(ctx('GET', '/export/clients', 'exportSpreadsheet'))).resolves.toBe(true);
  });
});

describe('Última situação conhecida (serviço de assinaturas fora do ar)', () => {
  it('BRECHA: quem estava bloqueado continua bloqueado quando o serviço cai', async () => {
    const remote = new FakeRemote();
    const proxy = new ResilientSubscriptionProxy(remote, 3, 60_000, new LastKnownAccessStore(null));

    remote.level = 'blocked';
    expect((await proxy.access(7)).level).toBe('blocked');

    remote.down = true;
    const d = await proxy.access(7);
    expect(d.level).toBe('blocked');
    expect(d.degraded).toBe(true);
  });

  it('empresa nunca vista continua em falha aberta (a oficina não para)', async () => {
    const remote = new FakeRemote();
    remote.down = true;
    const proxy = new ResilientSubscriptionProxy(remote, 3, 60_000, new LastKnownAccessStore(null));
    expect((await proxy.access(99)).level).toBe('full');
  });

  it('a última situação sobrevive a reinício do backend (vem do banco)', async () => {
    const rows = new Map<number, unknown>();
    const prisma = {
      subscriptionAccessSnapshot: {
        upsert: async ({ where, create }: any) => { rows.set(where.enterpriseId, create.decision); },
        findUnique: async ({ where }: any) => (rows.has(where.enterpriseId) ? { decision: rows.get(where.enterpriseId) } : null),
      },
    } as any;

    const remote = new FakeRemote();
    remote.level = 'blocked';
    await new ResilientSubscriptionProxy(remote, 3, 60_000, new LastKnownAccessStore(prisma)).access(7);
    await new Promise(r => setImmediate(r));

    // "reiniciou": proxy e memória novos, serviço fora
    remote.down = true;
    const fresh = new ResilientSubscriptionProxy(remote, 3, 60_000, new LastKnownAccessStore(prisma));
    expect((await fresh.access(7)).level).toBe('blocked');
  });
});
