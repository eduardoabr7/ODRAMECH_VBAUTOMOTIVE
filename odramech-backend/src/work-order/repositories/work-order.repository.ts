import { OrderStatus, TypeAppointment } from '@prisma/client';
import { WorkOrderCriteria } from '../domain/work-order-criteria';

export interface OpenWorkOrderInput {
  establishmentId: number;
  userCreationId: number;
  clientId: number;
  vehicleId: number;
  status: OrderStatus;
  userResponsibleId?: number | null;
  firstAppointment?: { contentHtml: string; appointmentType: TypeAppointment } | null;
}

export interface WorkOrderRef {
  id: number;
  numberOs: number;
  status: OrderStatus;
  userResponsibleId: number | null;
  establishmentId: number;
}

export interface Page<T> {
  items: T[];
  total: number;
}

/**
 * REPOSITORY (porta) — o que a aplicação precisa saber sobre persistência de OS.
 *
 * Os serviços e comandos dependem desta abstração (Dependency Inversion); a implementação
 * Prisma é injetada pelo módulo. Em testes, uma versão em memória cumpre o mesmo contrato.
 * Classe abstrata (e não interface) para servir também de token de injeção no Nest.
 */
export abstract class WorkOrderRepository {
  /** abre a OS reservando o próximo número do estabelecimento, de forma atômica */
  abstract open(input: OpenWorkOrderInput): Promise<WorkOrderRef>;

  abstract findPage(criteria: WorkOrderCriteria, page: number, pageSize: number): Promise<Page<any>>;
  abstract countByStatus(criteria: WorkOrderCriteria): Promise<Record<OrderStatus, number>>;
  abstract count(criteria: WorkOrderCriteria): Promise<number>;
  abstract findRecent(criteria: WorkOrderCriteria, take: number): Promise<any[]>;

  abstract findDetail(criteria: WorkOrderCriteria, id: number, includeInternal: boolean): Promise<any | null>;
  abstract findRef(id: number, establishmentId: number): Promise<WorkOrderRef | null>;

  abstract setStatus(id: number, status: OrderStatus, closedBy: number | null): Promise<void>;
  abstract setResponsible(id: number, userId: number | null): Promise<void>;

  abstract addAppointment(
    workOrderId: number,
    authorId: number,
    contentHtml: string,
    type: TypeAppointment,
  ): Promise<any>;

  /** o usuário trabalha (ADMIN/WORKER/SUPERUSER) neste estabelecimento? */
  abstract isStaffOf(userId: number, establishmentId: number): Promise<boolean>;
}
