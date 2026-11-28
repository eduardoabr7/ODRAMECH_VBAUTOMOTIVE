import { OrderStatus } from '@prisma/client';
import { DomainEvent } from 'src/core/events/domain-event-bus';

export class WorkOrderOpened extends DomainEvent {
  readonly name = 'work-order.opened';
  constructor(readonly workOrderId: number, readonly numberOs: number, readonly establishmentId: number, readonly userId: number) {
    super();
  }
}

/**
 * Algo visível na OS mudou (apontamento, anexo, item, pagamento, avaliação).
 * Status e responsável têm eventos próprios. Quem está com a OS aberta recebe o aviso "Recarregar".
 */
export class WorkOrderContentChanged extends DomainEvent {
  readonly name = 'work-order.content-changed';
  constructor(
    readonly workOrderId: number,
    readonly userId: number,
    /** só a equipe enxerga a mudança (nota interna): o cliente não é avisado */
    readonly staffOnly = false,
  ) {
    super();
  }
}

export class WorkOrderStatusChanged extends DomainEvent {
  readonly name = 'work-order.status-changed';
  constructor(
    readonly workOrderId: number,
    readonly from: OrderStatus,
    readonly to: OrderStatus,
    readonly userId: number,
    /** true quando a mudança veio de um "desfazer" */
    readonly reverted = false,
  ) {
    super();
  }
}

export class WorkOrderResponsibleChanged extends DomainEvent {
  readonly name = 'work-order.responsible-changed';
  constructor(readonly workOrderId: number, readonly responsibleId: number | null, readonly userId: number) {
    super();
  }
}
