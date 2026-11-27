import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TypeAppointment } from '@prisma/client';
import { DomainEventBus, DomainEventListener } from 'src/core/events/domain-event-bus';
import { WorkOrderRepository } from '../repositories/work-order.repository';
import { WorkOrderStatusChanged } from '../domain/work-order.events';
import { STATUS_LABEL } from '../domain/work-order-status';

/**
 * OBSERVER — registra cada mudança de status como apontamento PÚBLICO no histórico,
 * para o cliente acompanhar o serviço em tempo real (requisito do README).
 *
 * O comando que muda o status não sabe que isto existe.
 */
@Injectable()
export class StatusTimelineListener implements DomainEventListener<WorkOrderStatusChanged>, OnModuleInit {
  private readonly logger = new Logger('WorkOrderAudit');

  constructor(private readonly events: DomainEventBus, private readonly repo: WorkOrderRepository) {}

  onModuleInit(): void {
    this.events.subscribe(WorkOrderStatusChanged, this);
  }

  async handle(e: WorkOrderStatusChanged): Promise<void> {
    const verb = e.reverted ? 'Status revertido' : 'Status alterado';
    const html = `<p>${verb}: <b>${STATUS_LABEL[e.from]}</b> → <b>${STATUS_LABEL[e.to]}</b></p>`;
    await this.repo.addAppointment(e.workOrderId, e.userId, html, TypeAppointment.PUBLICO);
    this.logger.log(`OS ${e.workOrderId}: ${e.from} → ${e.to}${e.reverted ? ' (desfeito)' : ''} por usuário ${e.userId}`);
  }
}
