import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrderStatus } from '@prisma/client';
import { StockLedger } from './stock-ledger';
import { InsufficientStockException, StockContext } from './domain/stock';
import { ModuleAccessGuard } from 'src/contracted-modules/module-access.guard';
import { ModuleAccessService } from 'src/contracted-modules/module-access.service';
import { RequiresModule } from 'src/contracted-modules/requires-module.decorator';
import { ModuleContractsGateway } from 'src/contracted-modules/gateway/module-contracts.gateway';
import { ModuleContractsUnavailable } from 'src/contracted-modules/gateway/http-module-contracts.gateway';
import { ResilientModuleContractsGateway } from 'src/contracted-modules/gateway/resilient-module-contracts.gateway';
import { ModuleAccessSet } from 'src/contracted-modules/contracted-module';

// ═══ "Banco" em memória com só o que o StockLedger usa ══════════════════════
interface PartRow { id: number; establishmentId: number; name: string; quantity: number }
interface ItemRow { id: number; partId: number | null; quantity: number; stockQuantity: number; workOrderId: number | null }
interface WoRow { id: number; status: OrderStatus; establishmentId: number }

function fakeTx() {
  const parts: PartRow[] = [{ id: 1, establishmentId: 10, name: 'Filtro de óleo', quantity: 5 }];
  const wos: WoRow[] = [{ id: 100, status: OrderStatus.EM_ATENDIMENTO, establishmentId: 10 }];
  const items: ItemRow[] = [];
  const movements: any[] = [];
  const matchPart = (w: any) => (p: PartRow) => p.id === w.id && (w.establishmentId === undefined || p.establishmentId === w.establishmentId);

  const tx: any = {
    part: {
      updateMany: async ({ where, data }: any) => {
        const p = parts.find(matchPart(where));
        if (!p || (where.quantity?.gte !== undefined && p.quantity < where.quantity.gte)) return { count: 0 };
        p.quantity = Math.round((p.quantity + (data.quantity.increment ?? 0) - (data.quantity.decrement ?? 0)) * 100) / 100;
        return { count: 1 };
      },
      findFirst: async ({ where }: any) => parts.find(matchPart(where)) ?? null,
      findUniqueOrThrow: async ({ where }: any) => parts.find(p => p.id === where.id)!,
    },
    stockMovement: { create: async ({ data }: any) => { movements.push(data); return data; } },
    serviceItem: {
      findUnique: async ({ where }: any) => {
        const i = items.find(r => r.id === where.id);
        if (!i) return null;
        const part = parts.find(p => p.id === i.partId);
        return { ...i, workOrder: wos.find(w => w.id === i.workOrderId) ?? null, part: part ? { name: part.name, establishmentId: part.establishmentId } : null };
      },
      update: async ({ where, data }: any) => Object.assign(items.find(r => r.id === where.id)!, data),
      findMany: async ({ where }: any) => items.filter(i => i.workOrderId === where.workOrderId && i.partId !== null),
    },
  };
  return { tx, parts, wos, items, movements };
}

const ACTIVE: StockContext = { moduleActive: true, userId: 1 };
const INACTIVE: StockContext = { moduleActive: false, userId: 1 };

describe('StockLedger — baixa de peças pela OS', () => {
  const ledger = new StockLedger();

  it('item de OS baixa a quantidade e grava a movimentação com o saldo', async () => {
    const db = fakeTx();
    db.items.push({ id: 1, partId: 1, quantity: 2, stockQuantity: 0, workOrderId: 100 });
    await ledger.syncItem(db.tx, 1, ACTIVE);
    expect(db.parts[0].quantity).toBe(3);
    expect(db.items[0].stockQuantity).toBe(2);
    expect(db.movements[0]).toMatchObject({ type: 'OS_BAIXA', quantity: -2, balanceAfter: 3, workOrderId: 100 });
  });

  it('sem saldo: recusa com 409 e não mexe em nada', async () => {
    const db = fakeTx();
    db.items.push({ id: 1, partId: 1, quantity: 9, stockQuantity: 0, workOrderId: 100 });
    await expect(ledger.syncItem(db.tx, 1, ACTIVE)).rejects.toBeInstanceOf(InsufficientStockException);
    expect(db.parts[0].quantity).toBe(5);
    expect(db.movements).toHaveLength(0);
  });

  it('aumentar a quantidade baixa só a diferença; diminuir devolve', async () => {
    const db = fakeTx();
    db.items.push({ id: 1, partId: 1, quantity: 2, stockQuantity: 0, workOrderId: 100 });
    await ledger.syncItem(db.tx, 1, ACTIVE);
    db.items[0].quantity = 3;
    await ledger.syncItem(db.tx, 1, ACTIVE);
    expect(db.parts[0].quantity).toBe(2);
    db.items[0].quantity = 1;
    await ledger.syncItem(db.tx, 1, ACTIVE);
    expect(db.parts[0].quantity).toBe(4);
    expect(db.movements.map(m => m.type)).toEqual(['OS_BAIXA', 'OS_BAIXA', 'OS_ESTORNO']);
  });

  it('repetir a sincronização não baixa duas vezes (idempotente)', async () => {
    const db = fakeTx();
    db.items.push({ id: 1, partId: 1, quantity: 2, stockQuantity: 0, workOrderId: 100 });
    await ledger.syncItem(db.tx, 1, ACTIVE);
    await ledger.syncItem(db.tx, 1, ACTIVE);
    expect(db.parts[0].quantity).toBe(3);
  });

  it('remover o item (release) devolve exatamente o que saiu', async () => {
    const db = fakeTx();
    db.items.push({ id: 1, partId: 1, quantity: 2, stockQuantity: 0, workOrderId: 100 });
    await ledger.syncItem(db.tx, 1, ACTIVE);
    await ledger.syncItem(db.tx, 1, ACTIVE, { release: true });
    expect(db.parts[0].quantity).toBe(5);
  });

  it('item só de orçamento não baixa', async () => {
    const db = fakeTx();
    db.items.push({ id: 1, partId: 1, quantity: 2, stockQuantity: 0, workOrderId: null });
    await ledger.syncItem(db.tx, 1, ACTIVE);
    expect(db.parts[0].quantity).toBe(5);
  });

  it('contrato vencido: nada mais SAI do estoque, mas devoluções continuam', async () => {
    const db = fakeTx();
    db.items.push({ id: 1, partId: 1, quantity: 2, stockQuantity: 0, workOrderId: 100 });
    await ledger.syncItem(db.tx, 1, ACTIVE);
    db.items[0].quantity = 4;
    await ledger.syncItem(db.tx, 1, INACTIVE);
    expect(db.parts[0].quantity).toBe(3); // não baixou mais
    db.items[0].quantity = 1;
    await ledger.syncItem(db.tx, 1, INACTIVE);
    expect(db.parts[0].quantity).toBe(4); // devolveu 1
  });

  it('OS cancelada devolve tudo; reaberta sem saldo pula a peça em vez de falhar', async () => {
    const db = fakeTx();
    db.items.push({ id: 1, partId: 1, quantity: 5, stockQuantity: 0, workOrderId: 100 });
    await ledger.syncWorkOrder(db.tx, 100, ACTIVE);
    expect(db.parts[0].quantity).toBe(0);

    db.wos[0].status = OrderStatus.CANCELADA;
    await ledger.syncWorkOrder(db.tx, 100, ACTIVE, { lenient: true });
    expect(db.parts[0].quantity).toBe(5);

    db.parts[0].quantity = 1; // alguém usou no meio tempo
    db.wos[0].status = OrderStatus.PENDENTE;
    const skipped = await ledger.syncWorkOrder(db.tx, 100, ACTIVE, { lenient: true });
    expect(skipped).toEqual([{ itemId: 1, partName: 'Filtro de óleo', needed: 5, available: 1 }]);
    expect(db.items[0].stockQuantity).toBe(0);
  });

  it('peça de outro estabelecimento é recusada', async () => {
    const db = fakeTx();
    db.parts[0].establishmentId = 99;
    db.items.push({ id: 1, partId: 1, quantity: 1, stockQuantity: 0, workOrderId: 100 });
    await expect(ledger.syncItem(db.tx, 1, ACTIVE)).rejects.toThrow(/outro estabelecimento/);
    expect(db.parts[0].quantity).toBe(5);
  });
});

// ═══ Acesso ao módulo ═══════════════════════════════════════════════════════
class FakeContracts extends ModuleContractsGateway {
  calls = 0;
  down = false;
  active = true;
  async access(): Promise<ModuleAccessSet> {
    this.calls++;
    if (this.down) throw new ModuleContractsUnavailable('down');
    return { modules: [{ module: 'INVENTORY', active: this.active, until: null, reason: '' }] };
  }
  invalidate() {}
}

@RequiresModule('INVENTORY')
class InventoryRoutes { list() {} }
class OtherRoutes { list() {} }

function ctx(cls: any, auth: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ authContext: auth }) }),
    getHandler: () => cls.prototype.list,
    getClass: () => cls,
  } as unknown as ExecutionContext;
}

const AUTH = { sub: 1, enterpriseId: 7, establishmentId: 10, role: 'ADMIN', context: 'AUTH' };

describe('ModuleAccessGuard', () => {
  it('rota do estoque sem contrato → 403 MODULE_REQUIRED', async () => {
    const remote = new FakeContracts();
    remote.active = false;
    const guard = new ModuleAccessGuard(new Reflector(), new ModuleAccessService(remote));
    await expect(guard.canActivate(ctx(InventoryRoutes, AUTH))).rejects.toMatchObject({ response: { code: 'MODULE_REQUIRED' } });
  });

  it('com contrato passa; rotas fora do módulo nem consultam', async () => {
    const remote = new FakeContracts();
    const guard = new ModuleAccessGuard(new Reflector(), new ModuleAccessService(remote));
    await expect(guard.canActivate(ctx(InventoryRoutes, AUTH))).resolves.toBe(true);
    await expect(guard.canActivate(ctx(OtherRoutes, AUTH))).resolves.toBe(true);
    expect(remote.calls).toBe(1);
  });

  it('token de pré-login (sem empresa escolhida) não entra no módulo', async () => {
    const guard = new ModuleAccessGuard(new Reflector(), new ModuleAccessService(new FakeContracts()));
    await expect(guard.canActivate(ctx(InventoryRoutes, { ...AUTH, context: 'PRE_AUTH' }))).rejects.toMatchObject({ status: 403 });
  });
});

describe('ResilientModuleContractsGateway', () => {
  it('serviço fora: quem tinha o módulo continua; quem nunca foi visto fica sem (falha fechada)', async () => {
    const remote = new FakeContracts();
    const gw = new ResilientModuleContractsGateway(remote, null, 0);
    expect((await gw.access(7)).modules[0].active).toBe(true);

    remote.down = true;
    const known = await gw.access(7);
    expect(known.degraded).toBe(true);
    expect(known.modules[0].active).toBe(true);

    const stranger = await gw.access(8);
    expect(stranger.modules).toEqual([]);
  });

  it('cacheia e o aviso do serviço (invalidate) limpa na hora', async () => {
    const remote = new FakeContracts();
    const gw = new ResilientModuleContractsGateway(remote, null, 60_000);
    await gw.access(7);
    await gw.access(7);
    expect(remote.calls).toBe(1);
    remote.active = false;
    gw.invalidate(7);
    expect((await gw.access(7)).modules[0].active).toBe(false);
  });
});
