import { OrderStatus } from '@prisma/client';

export const OPEN_STATUSES: OrderStatus[] = [OrderStatus.PENDENTE, OrderStatus.EM_ATENDIMENTO, OrderStatus.AGUARDANDO_PECAS];
export const CLOSING_STATUSES: OrderStatus[] = [OrderStatus.FINALIZADA, OrderStatus.CANCELADA];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDENTE: 'Pendente',
  EM_ATENDIMENTO: 'Em atendimento',
  AGUARDANDO_PECAS: 'Aguardando peças',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

export function isClosing(status: OrderStatus): boolean {
  return CLOSING_STATUSES.includes(status);
}

/** Mapa status → contagem, sempre com todas as chaves (zeros incluídos). */
export function emptyStatusCount(): Record<OrderStatus, number> {
  return Object.fromEntries(Object.values(OrderStatus).map(s => [s, 0])) as Record<OrderStatus, number>;
}
