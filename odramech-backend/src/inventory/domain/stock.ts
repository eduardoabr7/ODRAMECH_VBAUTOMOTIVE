import { ConflictException } from '@nestjs/common';

/** Unidades aceitas para uma peça. */
export const PART_UNITS = ['UN', 'PC', 'PAR', 'JG', 'KIT', 'L', 'ML', 'KG', 'G', 'M', 'CX'] as const;
export type PartUnit = (typeof PART_UNITS)[number];

/** Contexto de uma operação que pode mexer no estoque a partir de um item de OS. */
export interface StockContext {
  /** contrato do módulo Estoque ativo? Sem ele nada SAI do estoque (devoluções continuam valendo). */
  moduleActive: boolean;
  userId: number;
}

/** item que não pôde ser baixado (só em operações tolerantes, ex.: reabrir OS cancelada) */
export interface SkippedWithdrawal {
  itemId: number;
  partName: string;
  needed: number;
  available: number;
}

export class InsufficientStockException extends ConflictException {
  constructor(readonly partName: string, readonly needed: number, readonly available: number) {
    super({
      statusCode: 409,
      code: 'INSUFFICIENT_STOCK',
      message: `Estoque insuficiente de "${partName}": precisa de ${fmt(needed)}, há ${fmt(available)}. Registre a entrada no estoque ou adicione o item sem vincular à peça.`,
      partName,
      needed,
      available,
    });
  }
}

export const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** quantidades com no máximo 2 casas (mesma escala do banco) */
export const qty = (n: number) => Math.round(n * 100) / 100;
