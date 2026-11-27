import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, Role, TypeAppointment } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';
import { WorkOrderCriteria } from '../domain/work-order-criteria';
import { emptyStatusCount, isClosing } from '../domain/work-order-status';
import { OpenWorkOrderInput, Page, WorkOrderRef, WorkOrderRepository } from './work-order.repository';

const PERSON = { select: { id: true, name: true, email: true, principalPhone: true } } as const;

const LIST_INCLUDE = {
  client: PERSON,
  vehicle: { select: { id: true, plate: true, name: true, make: true, color: true, modelYear: true, manufactureYear: true } },
  userResponsible: { select: { id: true, name: true } },
  userCreation: { select: { id: true, name: true } },
  _count: { select: { appointments: true } },
} satisfies Prisma.WorkOrderInclude;

const REF_SELECT = { id: true, numberOs: true, status: true, userResponsibleId: true, establishmentId: true } as const;

/** REPOSITORY (implementação) — traduz critérios de domínio para consultas Prisma. */
@Injectable()
export class PrismaWorkOrderRepository extends WorkOrderRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // ── Tradução de critério → where ───────────────────────
  private where(c: WorkOrderCriteria): Prisma.WorkOrderWhereInput {
    const where: Prisma.WorkOrderWhereInput = { establishmentId: c.establishmentId };
    if (c.onlyClientId) where.clientId = c.onlyClientId;
    if (c.clientId && !c.onlyClientId) where.clientId = c.clientId;
    if (c.vehicleId) where.vehicleId = c.vehicleId;
    if (c.status) where.status = c.status;
    if (c.createdFrom) where.dateTimeCreation = { gte: c.createdFrom };
    if (c.finishedFrom) where.dateTimeEnd = { gte: c.finishedFrom };

    if (c.term) {
      const n = Number(c.term.replace(/^#/, ''));
      const plate = c.term.toUpperCase().replace(/[^A-Z0-9]/g, '');
      where.OR = [
        { client: { name: { contains: c.term, mode: 'insensitive' } } },
        { vehicle: { name: { contains: c.term, mode: 'insensitive' } } },
        { vehicle: { make: { contains: c.term, mode: 'insensitive' } } },
        ...(plate ? [{ vehicle: { plate: { contains: plate } } }] : []),
        ...(Number.isInteger(n) && n > 0 ? [{ numberOs: n }] : []),
      ];
    }
    return where;
  }

  // ── Escrita ────────────────────────────────────────────
  async open(input: OpenWorkOrderInput): Promise<WorkOrderRef> {
    try {
      return await this.prisma.$transaction(async tx => {
        // upsert: estabelecimentos antigos (sem contador) também conseguem abrir OS
        const counter = await tx.establishmentOsCounter.upsert({
          where: { establishmentId: input.establishmentId },
          create: { establishmentId: input.establishmentId, lastNumberOs: 1 },
          update: { lastNumberOs: { increment: 1 } },
        });

        return tx.workOrder.create({
          data: {
            status: input.status,
            numberOs: counter.lastNumberOs,
            establishmentId: input.establishmentId,
            userCreationId: input.userCreationId,
            clientId: input.clientId,
            vehicleId: input.vehicleId,
            userResponsibleId: input.userResponsibleId ?? null,
            ...(input.firstAppointment && {
              appointments: {
                create: {
                  dateTime: new Date(),
                  contentHtml: input.firstAppointment.contentHtml,
                  appointmentType: input.firstAppointment.appointmentType,
                  userAppointmentId: input.userCreationId,
                },
              },
            }),
          },
          select: REF_SELECT,
        });
      });
    } catch (error: any) {
      if (error.code === 'P2003' || error.code === 'P2025') throw new NotFoundException('Cliente, veículo ou estabelecimento não encontrado.');
      if (error.code === 'P2002') throw new ConflictException('Número de OS já existe para este estabelecimento.');
      throw error;
    }
  }

  async setStatus(id: number, status: OrderStatus, closedBy: number | null): Promise<void> {
    const closing = isClosing(status);
    await this.prisma.workOrder.update({
      where: { id },
      data: {
        status,
        dateTimeEnd: closing ? new Date() : null,
        userEndId: closing ? closedBy : null,
      },
    });
  }

  async setResponsible(id: number, userId: number | null): Promise<void> {
    await this.prisma.workOrder.update({ where: { id }, data: { userResponsibleId: userId } });
  }

  addAppointment(workOrderId: number, authorId: number, contentHtml: string, type: TypeAppointment) {
    return this.prisma.appointment.create({
      data: { dateTime: new Date(), contentHtml, appointmentType: type, userAppointmentId: authorId, workOrderId },
      include: { userAppointment: { select: { id: true, name: true } }, archives: true },
    });
  }

  // ── Leitura ────────────────────────────────────────────
  async findPage(c: WorkOrderCriteria, page: number, pageSize: number): Promise<Page<any>> {
    const where = this.where(c);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.workOrder.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { dateTimeCreation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.workOrder.count({ where }),
    ]);
    return { items, total };
  }

  async countByStatus(c: WorkOrderCriteria): Promise<Record<OrderStatus, number>> {
    const grouped = await this.prisma.workOrder.groupBy({
      by: ['status'],
      where: this.where(c),
      orderBy: { status: 'asc' },
      _count: { _all: true },
    });
    const counts = emptyStatusCount();
    for (const g of grouped) counts[g.status] = (g._count as { _all: number })._all;
    return counts;
  }

  count(c: WorkOrderCriteria): Promise<number> {
    return this.prisma.workOrder.count({ where: this.where(c) });
  }

  findRecent(c: WorkOrderCriteria, take: number) {
    return this.prisma.workOrder.findMany({
      where: this.where(c),
      include: LIST_INCLUDE,
      orderBy: { dateTimeCreation: 'desc' },
      take,
    });
  }

  findDetail(c: WorkOrderCriteria, id: number, includeInternal: boolean) {
    return this.prisma.workOrder.findFirst({
      where: { id, ...this.where(c) },
      include: {
        ...LIST_INCLUDE,
        userEnd: { select: { id: true, name: true } },
        vehicle: true,
        appointments: {
          where: includeInternal ? {} : { appointmentType: TypeAppointment.PUBLICO },
          orderBy: { dateTime: 'asc' },
          include: { userAppointment: { select: { id: true, name: true } }, archives: true },
        },
        items: { orderBy: { id: 'asc' } },
        payments: { orderBy: { paidAt: 'asc' }, include: { user: { select: { id: true, name: true } } } },
        review: true,
        quote: { select: { id: true, numberQuote: true } },
      },
    });
  }

  findRef(id: number, establishmentId: number): Promise<WorkOrderRef | null> {
    return this.prisma.workOrder.findFirst({ where: { id, establishmentId }, select: REF_SELECT });
  }

  async isStaffOf(userId: number, establishmentId: number): Promise<boolean> {
    const relation = await this.prisma.userCorporation.findFirst({
      where: { idUser: userId, idEstablishment: establishmentId, role: { in: [Role.ADMIN, Role.WORKER, Role.SUPERUSER] } },
      select: { idUser: true },
    });
    return !!relation;
  }
}
