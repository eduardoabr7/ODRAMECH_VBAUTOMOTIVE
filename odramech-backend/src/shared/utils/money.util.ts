import { Prisma } from '@prisma/client';

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

/** Prisma devolve Decimal como objeto/string; a API sempre responde números. */
export function toNum(value: DecimalLike): number {
  if (value === null || value === undefined) return 0;
  return Number(value.toString());
}

export interface ItemLike {
  quantity: DecimalLike;
  unitPrice: DecimalLike;
  discount: DecimalLike;
}

export function itemTotal(item: ItemLike): number {
  return round(toNum(item.quantity) * toNum(item.unitPrice) - toNum(item.discount));
}

export function sumItems(items: ItemLike[] = []): number {
  return round(items.reduce((acc, i) => acc + itemTotal(i), 0));
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface MoneySummary {
  total: number;
  paid: number;
  balance: number;
}

/** Totais de uma OS: soma dos itens, total pago e saldo. */
export function summarizeMoney(items: ItemLike[], payments: { amount: DecimalLike }[]): MoneySummary {
  const total = sumItems(items);
  const paid = round(payments.reduce((acc, p) => acc + toNum(p.amount), 0));
  return { total, paid, balance: round(total - paid) };
}

/** Converte uma linha de item do Prisma para o formato da API. */
export function serializeItem<T extends ItemLike>(item: T) {
  return {
    ...item,
    quantity: toNum(item.quantity),
    unitPrice: toNum(item.unitPrice),
    discount: toNum(item.discount),
    total: itemTotal(item),
  };
}
