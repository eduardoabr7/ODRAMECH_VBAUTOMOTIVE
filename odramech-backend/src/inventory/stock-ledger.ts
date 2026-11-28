import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, StockMovementType } from '@prisma/client';
import { toNum } from 'src/shared/utils/money.util';
import { InsufficientStockException, qty, SkippedWithdrawal, StockContext } from './domain/stock';

type Tx = Prisma.TransactionClient;

export interface MoveInput {
  partId: number;
  establishmentId: number;
  /** variação com sinal: + entra, − sai */
  delta: number;
  type: StockMovementType;
  userId: number;
  note?: string | null;
  unitCost?: number | null;
  workOrderId?: number | null;
  serviceItemId?: number | null;
}

/**
 * LIVRO-RAZÃO do estoque — o ÚNICO lugar que altera o saldo de uma peça.
 *
 * Sempre recebe a transação de quem chama, então saldo, movimentação e a linha da OS mudam
 * juntos ou não mudam. A saída é um UPDATE condicional (`quantity >= x`): dois mecânicos
 * baixando a última unidade ao mesmo tempo → um consegue, o outro recebe 409. O banco ainda
 * tem um CHECK (quantity >= 0) como última barreira.
 */
@Injectable()
export class StockLedger {
  async move(tx: Tx, m: MoveInput) {
    const delta = qty(m.delta);
    if (delta === 0) return null;

    if (delta < 0) {
      const { count } = await tx.part.updateMany({
        where: { id: m.partId, establishmentId: m.establishmentId, quantity: { gte: -delta } },
        data: { quantity: { decrement: -delta } },
      });
      if (!count) {
        const part = await tx.part.findFirst({ where: { id: m.partId, establishmentId: m.establishmentId }, select: { name: true, quantity: true } });
        if (!part) throw new NotFoundException('Peça não encontrada no estoque deste estabelecimento.');
        throw new InsufficientStockException(part.name, -delta, toNum(part.quantity));
      }
    } else {
      const { count } = await tx.part.updateMany({
        where: { id: m.partId, establishmentId: m.establishmentId },
        data: { quantity: { increment: delta } },
      });
      if (!count) throw new NotFoundException('Peça não encontrada no estoque deste estabelecimento.');
    }

    const { quantity } = await tx.part.findUniqueOrThrow({ where: { id: m.partId }, select: { quantity: true } });
    return tx.stockMovement.create({
      data: {
        partId: m.partId,
        establishmentId: m.establishmentId,
        type: m.type,
        quantity: delta,
        balanceAfter: quantity,
        unitCost: m.unitCost ?? null,
        note: m.note ?? null,
        workOrderId: m.workOrderId ?? null,
        serviceItemId: m.serviceItemId ?? null,
        userId: m.userId,
      },
    });
  }

  /**
   * Acerta quanto a linha da OS tirou do estoque com quanto ela DEVERIA ter tirado:
   *  - item de orçamento (sem OS), OS cancelada ou `release` → 0 (tudo volta);
   *  - módulo ativo → a quantidade da linha;
   *  - módulo inativo → só pode devolver, nunca tirar mais.
   * `stockQuantity` guarda o que já saiu, então devoluções são sempre exatas e repetir é seguro.
   */
  async syncItem(tx: Tx, itemId: number, ctx: StockContext, opts: { release?: boolean; lenient?: boolean } = {}): Promise<SkippedWithdrawal | null> {
    const item = await tx.serviceItem.findUnique({
      where: { id: itemId },
      select: {
        id: true, partId: true, quantity: true, stockQuantity: true,
        workOrder: { select: { id: true, status: true, establishmentId: true } },
        part: { select: { name: true, establishmentId: true } },
      },
    });
    if (!item?.partId || !item.part) return null;

    const current = toNum(item.stockQuantity);
    const wo = item.workOrder;
    let target = 0;
    if (!opts.release && wo && wo.status !== OrderStatus.CANCELADA) {
      target = ctx.moduleActive ? toNum(item.quantity) : Math.min(current, toNum(item.quantity));
    }
    const toWithdraw = qty(target - current);
    if (toWithdraw === 0) return null;

    // defesa extra: peça e OS precisam ser do mesmo estabelecimento
    const establishmentId = wo?.establishmentId ?? item.part.establishmentId;
    if (item.part.establishmentId !== establishmentId) throw new ForbiddenException('Peça de outro estabelecimento.');

    try {
      await this.move(tx, {
        partId: item.partId,
        establishmentId,
        delta: -toWithdraw,
        type: toWithdraw > 0 ? StockMovementType.OS_BAIXA : StockMovementType.OS_ESTORNO,
        userId: ctx.userId,
        workOrderId: wo?.id ?? null,
        serviceItemId: item.id,
      });
    } catch (err) {
      if (opts.lenient && err instanceof InsufficientStockException) {
        return { itemId: item.id, partName: err.partName, needed: err.needed, available: err.available };
      }
      throw err;
    }
    await tx.serviceItem.update({ where: { id: item.id }, data: { stockQuantity: target } });
    return null;
  }

  /** todas as linhas com peça de uma OS (conversão de orçamento, cancelar/reabrir) */
  async syncWorkOrder(tx: Tx, workOrderId: number, ctx: StockContext, opts: { lenient?: boolean } = {}): Promise<SkippedWithdrawal[]> {
    const items = await tx.serviceItem.findMany({ where: { workOrderId, partId: { not: null } }, select: { id: true }, orderBy: { id: 'asc' } });
    const skipped: SkippedWithdrawal[] = [];
    for (const { id } of items) {
      const s = await this.syncItem(tx, id, ctx, opts);
      if (s) skipped.push(s);
    }
    return skipped;
  }
}
