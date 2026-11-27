import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { DomainEventBus } from 'src/core/events/domain-event-bus';
import { isStaff } from 'src/shared/utils/role.util';
import { serializeItem, summarizeMoney, toNum } from 'src/shared/utils/money.util';
import { WorkOrderRepository } from '../repositories/work-order.repository';
import { WorkOrderCriteriaBuilder } from '../domain/work-order-criteria';
import { WorkOrderOpened } from '../domain/work-order.events';
import { WoListQueryDTO } from '../dto/wo-update.dto';
import { WoCreateFrontDTO } from '../dto/wo-create-front.dto';

/**
 * Casos de uso de LEITURA e abertura de OS.
 * Escritas sobre uma OS existente são Commands (ver commands/work-order.commands.ts).
 * Persistência só via WorkOrderRepository (nada de Prisma aqui).
 */
@Injectable()
export class WorkOrderService {
  constructor(
    private readonly repo: WorkOrderRepository,
    private readonly events: DomainEventBus,
  ) {}

  async open(auth: AuthPayload, dto: WoCreateFrontDTO) {
    const ref = await this.repo.open({
      establishmentId: auth.establishmentId,
      userCreationId: auth.sub,
      clientId: dto.clientId,
      vehicleId: dto.vehicleId,
      status: dto.status,
      userResponsibleId: dto.userResponsibleId ?? null,
      firstAppointment: dto.appointment
        ? { contentHtml: dto.appointment.contentHtml, appointmentType: dto.appointment.appointmentType }
        : null,
    });
    await this.events.publish(new WorkOrderOpened(ref.id, ref.numberOs, auth.establishmentId, auth.sub));
    return ref;
  }

  async list(auth: AuthPayload, query: WoListQueryDTO) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const builder = WorkOrderCriteriaBuilder.for(auth)
      .withStatus(query.status)
      .ofClient(query.clientId)
      .ofVehicle(query.vehicleId)
      .matching(query.search);

    const [{ items, total }, countsByStatus] = await Promise.all([
      this.repo.findPage(builder.build(), page, pageSize),
      // contagem por status respeita a busca, mas ignora o filtro de status (para as abas)
      this.repo.countByStatus(builder.withoutStatus()),
    ]);

    return { items, total, page, pageSize, countsByStatus };
  }

  async getById(auth: AuthPayload, id: number) {
    const criteria = WorkOrderCriteriaBuilder.for(auth).build();
    const wo = await this.repo.findDetail(criteria, id, isStaff(auth.role));
    if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');

    const { items, payments, ...rest } = wo;
    return {
      ...rest,
      items: items.map(serializeItem),
      payments: payments.map((p: any) => ({ ...p, amount: toNum(p.amount) })),
      summary: summarizeMoney(items, payments),
    };
  }
}
