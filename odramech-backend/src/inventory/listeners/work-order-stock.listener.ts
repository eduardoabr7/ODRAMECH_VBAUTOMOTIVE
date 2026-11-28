import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OrderStatus, TypeAppointment } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';
import { DomainEventBus, DomainEventListener } from 'src/core/events/domain-event-bus';
import { ContractedModule } from 'src/contracted-modules/contracted-module';
import { ModuleAccessService } from 'src/contracted-modules/module-access.service';
import { WorkOrderStatusChanged } from 'src/work-order/domain/work-order.events';
import { WorkOrderRepository } from 'src/work-order/repositories/work-order.repository';
import { escapeHtml } from 'src/shared/utils/html.util';
import { StockLedger } from '../stock-ledger';
import { fmt } from '../domain/stock';

/**
 * OBSERVER — OS cancelada devolve as peças ao estoque; OS reaberta (inclusive pelo "desfazer")
 * baixa de novo. Na reabertura a baixa é tolerante: peça sem saldo fica sem baixar e o
 * histórico INTERNO da OS registra o que faltou (a reabertura nunca é impedida).
 * O comando que muda o status não sabe que isto existe.
 */
@Injectable()
export class WorkOrderStockListener implements DomainEventListener<WorkOrderStatusChanged>, OnModuleInit {
  private readonly logger = new Logger('InventoryWorkOrder');

  constructor(
    private readonly events: DomainEventBus,
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedger,
    private readonly modules: ModuleAccessService,
    private readonly workOrders: WorkOrderRepository,
  ) {}

  onModuleInit(): void {
    this.events.subscribe(WorkOrderStatusChanged, this);
  }

  async handle(e: WorkOrderStatusChanged): Promise<void> {
    const canceled = e.to === OrderStatus.CANCELADA;
    const reopened = e.from === OrderStatus.CANCELADA && e.to !== OrderStatus.CANCELADA;
    if (!canceled && !reopened) return;

    const linked = await this.prisma.serviceItem.count({ where: { workOrderId: e.workOrderId, partId: { not: null } } });
    if (!linked) return;

    const wo = await this.prisma.workOrder.findUnique({ where: { id: e.workOrderId }, select: { establishment: { select: { enterpriseId: true } } } });
    if (!wo) return;
    const moduleActive = await this.modules.isActive(wo.establishment.enterpriseId, ContractedModule.INVENTORY);

    const skipped = await this.prisma.$transaction(tx =>
      this.ledger.syncWorkOrder(tx, e.workOrderId, { moduleActive, userId: e.userId }, { lenient: true }),
    );
    this.logger.log(`OS ${e.workOrderId} ${canceled ? 'cancelada: peças devolvidas' : 'reaberta: peças baixadas'}${skipped.length ? ` (${skipped.length} sem saldo)` : ''}`);

    if (skipped.length) {
      const lines = skipped.map(s => `<li>${escapeHtml(s.partName)}: precisava ${fmt(s.needed)}, havia ${fmt(s.available)}</li>`).join('');
      await this.workOrders.addAppointment(
        e.workOrderId, e.userId,
        `<p><b>Estoque:</b> estas peças não foram baixadas na reabertura por falta de saldo:</p><ul>${lines}</ul>`,
        TypeAppointment.INTERNO,
      );
    }
  }
}
