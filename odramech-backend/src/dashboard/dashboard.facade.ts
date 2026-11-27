import { Injectable } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { PrismaService } from 'src/core/database/prisma.service';
import { LogExecution } from 'src/core/decorators/log-execution.decorator';
import { WorkOrderRepository } from 'src/work-order/repositories/work-order.repository';
import { WorkOrderCriteriaBuilder } from 'src/work-order/domain/work-order-criteria';
import { OPEN_STATUSES } from 'src/work-order/domain/work-order-status';
import { WorkOrderMoneyService } from 'src/billing/services/work-order-money.service';

/**
 * FACADE — uma chamada para a tela inicial, por trás de vários subsistemas
 * (OS, financeiro, clientes). O controller e o frontend não conhecem essa orquestração.
 */
@Injectable()
export class DashboardFacade {
  constructor(
    private readonly workOrders: WorkOrderRepository,
    private readonly money: WorkOrderMoneyService,
    private readonly prisma: PrismaService,
  ) {}

  @LogExecution('Dashboard.overview')
  async overview(auth: AuthPayload) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay);
    startOfMonth.setDate(1);

    const base = () => WorkOrderCriteriaBuilder.for(auth);

    const [byStatus, finishedToday, openedToday, openedThisMonth, clients, recent, finance] = await Promise.all([
      this.workOrders.countByStatus(base().build()),
      this.workOrders.count(base().withStatus(OrderStatus.FINALIZADA).finishedSince(startOfDay).build()),
      this.workOrders.count(base().createdSince(startOfDay).build()),
      this.workOrders.count(base().createdSince(startOfMonth).build()),
      this.prisma.userCorporation.count({ where: { idEstablishment: auth.establishmentId, role: Role.USER } }),
      this.workOrders.findRecent(base().build(), 6),
      this.money.financialReport(auth),
    ]);

    const open = OPEN_STATUSES.reduce((acc, s) => acc + byStatus[s], 0);
    return { byStatus, open, finishedToday, openedToday, openedThisMonth, clients, recent, finance };
  }
}
