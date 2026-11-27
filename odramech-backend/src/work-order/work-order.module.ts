import { Module } from '@nestjs/common';
import { WorkOrderController } from './controllers/work-order.controller';
import { WorkOrderService } from './services/work-order.service';
import { WorkOrderRepository } from './repositories/work-order.repository';
import { PrismaWorkOrderRepository } from './repositories/prisma-work-order.repository';
import { WorkOrderCommandFactory } from './commands/work-order.commands';
import { StatusTimelineListener } from './listeners/status-timeline.listener';

@Module({
  controllers: [WorkOrderController],
  providers: [
    WorkOrderService,
    WorkOrderCommandFactory,
    StatusTimelineListener,
    { provide: WorkOrderRepository, useClass: PrismaWorkOrderRepository },
  ],
  exports: [WorkOrderRepository, WorkOrderService],
})
export class WorkOrderModule {}
