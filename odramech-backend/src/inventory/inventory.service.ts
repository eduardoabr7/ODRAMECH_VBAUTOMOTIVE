import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Part, Prisma, StockMovementType } from '@prisma/client';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { PrismaService } from 'src/core/database/prisma.service';
import { assertManager, assertStaff } from 'src/shared/utils/role.util';
import { round, toNum } from 'src/shared/utils/money.util';
import { StockLedger } from './stock-ledger';
import { qty } from './domain/stock';
import { MovementListQueryDTO, PartCreateDTO, PartListQueryDTO, PartUpdateDTO, StockMovementDTO } from './dto/inventory.dto';

const MOVEMENT_SELECT = {
  id: true, type: true, quantity: true, balanceAfter: true, unitCost: true, note: true,
  workOrderId: true, serviceItemId: true, userId: true, createdAt: true,
  part: { select: { id: true, name: true, code: true, unit: true } },
} satisfies Prisma.StockMovementSelect;

const emptyToNull = (v: string | undefined) => (v === undefined ? undefined : v || null);

/**
 * Casos de uso do módulo Estoque. Tudo é escopo do estabelecimento da sessão
 * (estoque é físico) e exige perfil da equipe; cadastro e ajuste de inventário só gestores.
 * O acesso ao módulo (contrato) já foi garantido pelo ModuleAccessGuard no controller.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService, private readonly ledger: StockLedger) {}

  // ── Consultas ───────────────────────────────────────────
  async list(auth: AuthPayload, q: PartListQueryDTO) {
    assertStaff(auth.role);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 30;
    const where: Prisma.PartWhereInput = {
      establishmentId: auth.establishmentId,
      ...(q.includeInactive ? {} : { active: true }),
      ...(q.lowStock ? { minQuantity: { gt: 0 }, quantity: { lte: this.prisma.part.fields.minQuantity } } : {}),
    };
    if (q.search) {
      where.OR = (['name', 'code', 'oemCode', 'brand', 'location'] as const).map(f => ({ [f]: { contains: q.search, mode: 'insensitive' } }));
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.part.findMany({ where, orderBy: [{ active: 'desc' }, { name: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.part.count({ where }),
    ]);
    return { items: rows.map(serializePart), total, page, pageSize };
  }

  async summary(auth: AuthPayload) {
    assertStaff(auth.role);
    const parts = await this.prisma.part.findMany({
      where: { establishmentId: auth.establishmentId, active: true },
      select: { quantity: true, minQuantity: true, costPrice: true },
    });
    let stockValue = 0, lowStock = 0, outOfStock = 0;
    for (const p of parts) {
      const q = toNum(p.quantity);
      stockValue += q * toNum(p.costPrice);
      if (q <= 0) outOfStock++;
      else if (toNum(p.minQuantity) > 0 && q <= toNum(p.minQuantity)) lowStock++;
    }
    return { totalParts: parts.length, lowStock, outOfStock, stockValue: round(stockValue) };
  }

  async get(auth: AuthPayload, id: number) {
    assertStaff(auth.role);
    const part = await this.mustFind(auth, id);
    const { items } = await this.movements(auth, { partId: id, pageSize: 20 });
    return { ...serializePart(part), movements: items };
  }

  async movements(auth: AuthPayload, q: MovementListQueryDTO) {
    assertStaff(auth.role);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 50;
    const where: Prisma.StockMovementWhereInput = { establishmentId: auth.establishmentId, ...(q.partId ? { partId: q.partId } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({ where, select: MOVEMENT_SELECT, orderBy: { id: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.stockMovement.count({ where }),
    ]);
    // nomes de quem movimentou e número da OS (sem FK no histórico — ele sobrevive à OS/usuário)
    const userIds = [...new Set(rows.map(r => r.userId))];
    const woIds = [...new Set(rows.map(r => r.workOrderId).filter((v): v is number => !!v))];
    const [users, wos] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
      this.prisma.workOrder.findMany({ where: { id: { in: woIds }, establishmentId: auth.establishmentId }, select: { id: true, numberOs: true } }),
    ]);
    const userName = new Map(users.map(u => [u.id, u.name] as const));
    const osNumber = new Map(wos.map(w => [w.id, w.numberOs] as const));
    return {
      items: rows.map(r => ({
        ...r,
        quantity: toNum(r.quantity),
        balanceAfter: toNum(r.balanceAfter),
        unitCost: r.unitCost === null ? null : toNum(r.unitCost),
        userName: userName.get(r.userId) ?? null,
        numberOs: r.workOrderId ? osNumber.get(r.workOrderId) ?? null : null,
      })),
      total, page, pageSize,
    };
  }

  // ── Cadastro (gestores) ─────────────────────────────────
  async create(auth: AuthPayload, dto: PartCreateDTO) {
    assertManager(auth.role);
    const id = await this.unique(() => this.prisma.$transaction(async tx => {
      const part = await tx.part.create({
        data: {
          establishmentId: auth.establishmentId,
          code: dto.code || null,
          name: dto.name,
          brand: dto.brand || null,
          oemCode: dto.oemCode || null,
          unit: dto.unit ?? 'UN',
          costPrice: dto.costPrice ?? 0,
          salePrice: dto.salePrice ?? 0,
          minQuantity: dto.minQuantity ?? 0,
          location: dto.location || null,
          notes: dto.notes || null,
        },
        select: { id: true },
      });
      if (dto.initialQuantity) {
        await this.ledger.move(tx, {
          partId: part.id, establishmentId: auth.establishmentId, delta: dto.initialQuantity, type: StockMovementType.ENTRADA,
          userId: auth.sub, note: 'Saldo inicial', unitCost: dto.costPrice ?? null,
        });
      }
      return part.id;
    }));
    return this.get(auth, id);
  }

  async update(auth: AuthPayload, id: number, dto: PartUpdateDTO) {
    assertManager(auth.role);
    await this.mustFind(auth, id);
    await this.unique(() => this.prisma.part.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: emptyToNull(dto.code) }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.brand !== undefined && { brand: emptyToNull(dto.brand) }),
        ...(dto.oemCode !== undefined && { oemCode: emptyToNull(dto.oemCode) }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.costPrice !== undefined && { costPrice: dto.costPrice }),
        ...(dto.salePrice !== undefined && { salePrice: dto.salePrice }),
        ...(dto.minQuantity !== undefined && { minQuantity: dto.minQuantity }),
        ...(dto.location !== undefined && { location: emptyToNull(dto.location) }),
        ...(dto.notes !== undefined && { notes: emptyToNull(dto.notes) }),
      },
    }));
    return this.get(auth, id);
  }

  /** desativar esconde a peça das buscas e do vínculo com itens; nada é apagado */
  async setActive(auth: AuthPayload, id: number, active: boolean) {
    assertManager(auth.role);
    await this.mustFind(auth, id);
    await this.prisma.part.update({ where: { id }, data: { active } });
    return this.get(auth, id);
  }

  // ── Movimentações ───────────────────────────────────────
  async move(auth: AuthPayload, partId: number, dto: StockMovementDTO) {
    assertStaff(auth.role);
    // ajuste de inventário reescreve o saldo: só gestores
    if (dto.type === 'AJUSTE') assertManager(auth.role);
    const part = await this.mustFind(auth, partId);
    if (!part.active) throw new ConflictException('Peça desativada: reative antes de movimentar.');
    if (dto.type !== 'AJUSTE' && dto.quantity <= 0) throw new BadRequestException('Informe uma quantidade maior que zero.');
    if (dto.type === 'AJUSTE' && !dto.note) throw new BadRequestException('Explique o motivo do ajuste (ex.: contagem de inventário).');

    await this.prisma.$transaction(async tx => {
      let delta: number;
      if (dto.type === 'AJUSTE') {
        // novo saldo = contado. Lê e grava com checagem otimista: se alguém movimentou no meio, recusa.
        const current = toNum((await tx.part.findUniqueOrThrow({ where: { id: partId }, select: { quantity: true } })).quantity);
        delta = qty(dto.quantity - current);
        if (delta === 0) throw new BadRequestException('O saldo contado é igual ao atual.');
        const { count } = await tx.part.updateMany({ where: { id: partId, quantity: current }, data: { quantity: dto.quantity } });
        if (!count) throw new ConflictException('O saldo mudou enquanto você ajustava. Confira e tente de novo.');
        await tx.stockMovement.create({
          data: {
            partId, establishmentId: auth.establishmentId, type: StockMovementType.AJUSTE, quantity: delta,
            balanceAfter: dto.quantity, note: dto.note ?? null, userId: auth.sub,
          },
        });
        return;
      }
      delta = dto.type === 'ENTRADA' ? dto.quantity : -dto.quantity;
      await this.ledger.move(tx, {
        partId, establishmentId: auth.establishmentId, delta, type: dto.type as StockMovementType,
        userId: auth.sub, note: dto.note ?? null, unitCost: dto.type === 'ENTRADA' ? dto.unitCost ?? null : null,
      });
      // custo da última compra vira o custo da peça
      if (dto.type === 'ENTRADA' && dto.unitCost !== undefined) await tx.part.update({ where: { id: partId }, data: { costPrice: dto.unitCost } });
    });
    return this.get(auth, partId);
  }

  // ── Internos ────────────────────────────────────────────
  private async mustFind(auth: AuthPayload, id: number): Promise<Part> {
    // peça de outro estabelecimento = 404 (não revela que existe)
    const part = await this.prisma.part.findFirst({ where: { id, establishmentId: auth.establishmentId } });
    if (!part) throw new NotFoundException('Peça não encontrada.');
    return part;
  }

  private async unique<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Já existe uma peça com este código neste estabelecimento.');
      }
      throw err;
    }
  }
}

export function serializePart(p: Part) {
  const quantity = toNum(p.quantity);
  const minQuantity = toNum(p.minQuantity);
  return {
    ...p,
    quantity,
    minQuantity,
    costPrice: toNum(p.costPrice),
    salePrice: toNum(p.salePrice),
    lowStock: minQuantity > 0 && quantity <= minQuantity,
  };
}
