import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, TypeAppointment } from '@prisma/client';
import { Command } from 'src/core/commands/command-bus';
import { DomainEventBus } from 'src/core/events/domain-event-bus';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { assertStaff } from 'src/shared/utils/role.util';
import { WorkOrderRepository } from '../repositories/work-order.repository';
import { WorkOrderResponsibleChanged, WorkOrderStatusChanged } from '../domain/work-order.events';
import { STATUS_LABEL } from '../domain/work-order-status';

// ═════════════════════════════════════════════════════════
// COMMANDS — cada operação de escrita sobre a OS é um objeto.
// Os reversíveis implementam undo(); o CommandBus guarda o token de desfazer.
// ═════════════════════════════════════════════════════════

export class ChangeStatusCommand implements Command<void> {
  private previous: OrderStatus | null = null;
  readonly label: string;

  constructor(
    private readonly repo: WorkOrderRepository,
    private readonly events: DomainEventBus,
    private readonly auth: AuthPayload,
    private readonly workOrderId: number,
    private readonly next: OrderStatus,
  ) {
    this.label = `OS ${workOrderId} → ${STATUS_LABEL[next]}`;
  }

  async execute(): Promise<void> {
    const ref = await this.repo.findRef(this.workOrderId, this.auth.establishmentId);
    if (!ref) throw new NotFoundException('Ordem de serviço não encontrada');
    if (ref.status === this.next) return;

    this.previous = ref.status;
    await this.repo.setStatus(this.workOrderId, this.next, this.auth.sub);
    await this.events.publish(new WorkOrderStatusChanged(this.workOrderId, ref.status, this.next, this.auth.sub));
  }

  async undo(): Promise<void> {
    if (!this.previous) return;
    await this.repo.setStatus(this.workOrderId, this.previous, this.auth.sub);
    await this.events.publish(new WorkOrderStatusChanged(this.workOrderId, this.next, this.previous, this.auth.sub, true));
  }
}

export class AssignResponsibleCommand implements Command<void> {
  private previous: number | null | undefined;
  readonly label: string;

  constructor(
    private readonly repo: WorkOrderRepository,
    private readonly events: DomainEventBus,
    private readonly auth: AuthPayload,
    private readonly workOrderId: number,
    private readonly responsibleId: number | null,
  ) {
    this.label = `OS ${workOrderId} → responsável ${responsibleId ?? 'nenhum'}`;
  }

  async execute(): Promise<void> {
    const ref = await this.repo.findRef(this.workOrderId, this.auth.establishmentId);
    if (!ref) throw new NotFoundException('Ordem de serviço não encontrada');

    if (this.responsibleId && !(await this.repo.isStaffOf(this.responsibleId, this.auth.establishmentId))) {
      throw new ForbiddenException('O responsável precisa ser um colaborador deste estabelecimento.');
    }

    this.previous = ref.userResponsibleId;
    await this.repo.setResponsible(this.workOrderId, this.responsibleId);
    await this.events.publish(new WorkOrderResponsibleChanged(this.workOrderId, this.responsibleId, this.auth.sub));
  }

  async undo(): Promise<void> {
    if (this.previous === undefined) return;
    await this.repo.setResponsible(this.workOrderId, this.previous);
    await this.events.publish(new WorkOrderResponsibleChanged(this.workOrderId, this.previous, this.auth.sub));
  }
}

export class AddAppointmentCommand implements Command<any> {
  readonly label: string;

  constructor(
    private readonly repo: WorkOrderRepository,
    private readonly auth: AuthPayload,
    private readonly workOrderId: number,
    private readonly contentHtml: string,
    private readonly type: TypeAppointment,
  ) {
    this.label = `OS ${workOrderId} → apontamento ${type}`;
  }

  async execute() {
    const ref = await this.repo.findRef(this.workOrderId, this.auth.establishmentId);
    if (!ref) throw new NotFoundException('Ordem de serviço não encontrada');
    return this.repo.addAppointment(this.workOrderId, this.auth.sub, this.contentHtml, this.type);
  }
}

/**
 * FACTORY de comandos — centraliza a criação (e a checagem de permissão comum),
 * para o controller/serviço não precisar conhecer as dependências de cada comando.
 */
@Injectable()
export class WorkOrderCommandFactory {
  constructor(private readonly repo: WorkOrderRepository, private readonly events: DomainEventBus) {}

  changeStatus(auth: AuthPayload, id: number, status: OrderStatus) {
    assertStaff(auth.role);
    return new ChangeStatusCommand(this.repo, this.events, auth, id, status);
  }

  assignResponsible(auth: AuthPayload, id: number, responsibleId: number | null) {
    assertStaff(auth.role);
    return new AssignResponsibleCommand(this.repo, this.events, auth, id, responsibleId);
  }

  addAppointment(auth: AuthPayload, id: number, contentHtml: string, type: TypeAppointment) {
    assertStaff(auth.role);
    return new AddAppointmentCommand(this.repo, auth, id, contentHtml, type);
  }
}
