import { Module } from '@nestjs/common';
import { WorkOrderController } from './controllers/work-order.controller';
import { WorkOrderService } from './services/work-order.service';
import { WorkOrderRepository } from './repositories/work-order.repository';
import { PrismaWorkOrderRepository } from './repositories/prisma-work-order.repository';
import { WorkOrderCommandFactory } from './commands/work-order.commands';
import { StatusTimelineListener } from './listeners/status-timeline.listener';
import { SettingsModule } from 'src/settings/settings.module';
import { AppointmentAccess, ClientParticipationSettings } from './domain/appointment-access';
import { SettingsClientParticipation } from './adapters/settings-client-participation.adapter';

@Module({
  imports: [SettingsModule],
  controllers: [WorkOrderController],
  providers: [
    WorkOrderService,
    AppointmentAccess,
    { provide: ClientParticipationSettings, useClass: SettingsClientParticipation },
    WorkOrderCommandFactory,
    StatusTimelineListener,
    { provide: WorkOrderRepository, useClass: PrismaWorkOrderRepository },
  ],
  exports: [WorkOrderRepository, WorkOrderService, AppointmentAccess],
})
export class WorkOrderModule {}
