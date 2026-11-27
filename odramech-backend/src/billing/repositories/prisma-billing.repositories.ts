import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentMethod, Prisma, QuoteStatus, TypeAppointment } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';
import { toNum } from 'src/shared/utils/money.util';
import {
  CreateQuoteData, ItemData, NoteRepository, PaymentRepository, QuoteFilter, QuoteRepository,
  QuoteScope, ReviewRepository, ServiceItemRepository,
} from './billing.repositories';

const PERSON = { select: { id: true, name: true, email: true, principalPhone: true } } as const;
const VEHICLE = { select: { id: true, plate: true, name: true, make: true, color: true, modelYear: true, manufactureYear: true } } as const;

const QUOTE_INCLUDE = {
  client: PERSON,
  vehicle: VEHICLE,
  userCreation: { select: { id: true, name: true } },
  workOrder: { select: { id: true, numberOs: true, status: true } },
  items: { orderBy: { id: 'asc' } },
  // últimos e-mails enviados ao cliente (histórico na tela do orçamento)
  emails: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, version: true, kind: true, trigger: true, status: true, toEmail: true, error: true, createdAt: true } },
} satisfies Prisma.QuoteInclude;

function scopeWhere(s: QuoteScope): Prisma.QuoteWhereInput {
  return { establishmentId: s.establishmentId, ...(s.onlyClientId ? { clientId: s.onlyClientId } : {}) };
}

@Injectable()
export class PrismaQuoteRepository extends QuoteRepository {
  constructor(private readonly prisma: PrismaService) { super(); }

  list(f: QuoteFilter, take: number) {
    const where: Prisma.QuoteWhereInput = { ...scopeWhere(f), ...(f.status ? { status: f.status } : {}) };
    if (f.term) {
      const n = Number(f.term.replace(/^#/, ''));
      const plate = f.term.toUpperCase().replace(/[^A-Z0-9]/g, '');
      where.OR = [
        { client: { name: { contains: f.term, mode: 'insensitive' } } },
        { vehicle: { name: { contains: f.term, mode: 'insensitive' } } },
        ...(plate ? [{ vehicle: { plate: { contains: plate } } }] : []),
        ...(Number.isInteger(n) && n > 0 ? [{ numberQuote: n }] : []),
      ];
    }
    return this.prisma.quote.findMany({ where, include: QUOTE_INCLUDE, orderBy: { createdAt: 'desc' }, take });
  }

  findOne(scope: QuoteScope, id: number) {
    return this.prisma.quote.findFirst({ where: { id, ...scopeWhere(scope) }, include: QUOTE_INCLUDE });
  }

  create(d: CreateQuoteData) {
    return this.prisma.$transaction(async tx => {
      const counter = await tx.establishmentOsCounter.upsert({
        where: { establishmentId: d.establishmentId },
        create: { establishmentId: d.establishmentId, lastNumberQuote: 1 },
        update: { lastNumberQuote: { increment: 1 } },
      });
      return tx.quote.create({
        data: {
          numberQuote: counter.lastNumberQuote,
          establishmentId: d.establishmentId,
          clientId: d.clientId,
          vehicleId: d.vehicleId,
          userCreationId: d.userCreationId,
          validUntil: d.validUntil,
          notes: d.notes,
          items: { create: d.items },
        },
        select: { id: true },
      });
    });
  }

  async update(id: number, data: { status?: QuoteStatus; validUntil?: Date | null; notes?: string | null }) {
    await this.prisma.quote.update({ where: { id }, data });
  }

  convertToWorkOrder(quoteId: number, userId: number, firstNoteHtml: string) {
    return this.prisma.$transaction(async tx => {
      const quote = await tx.quote.findUniqueOrThrow({ where: { id: quoteId } });
      const counter = await tx.establishmentOsCounter.upsert({
        where: { establishmentId: quote.establishmentId },
        create: { establishmentId: quote.establishmentId, lastNumberOs: 1 },
        update: { lastNumberOs: { increment: 1 } },
      });
      const wo = await tx.workOrder.create({
        data: {
          status: OrderStatus.PENDENTE,
          numberOs: counter.lastNumberOs,
          establishmentId: quote.establishmentId,
          userCreationId: userId,
          clientId: quote.clientId,
          vehicleId: quote.vehicleId,
          appointments: {
            create: { dateTime: new Date(), appointmentType: TypeAppointment.PUBLICO, contentHtml: firstNoteHtml, userAppointmentId: userId },
          },
        },
        select: { id: true, numberOs: true },
      });
      await tx.serviceItem.updateMany({ where: { quoteId }, data: { workOrderId: wo.id } });
      await tx.quote.update({ where: { id: quoteId }, data: { status: QuoteStatus.APROVADO, workOrderId: wo.id } });
      return wo;
    });
  }
}

@Injectable()
export class PrismaServiceItemRepository extends ServiceItemRepository {
  constructor(private readonly prisma: PrismaService) { super(); }

  addToQuote(quoteId: number, item: ItemData) {
    return this.prisma.serviceItem.create({ data: { ...item, quoteId } });
  }

  addToWorkOrder(workOrderId: number, item: ItemData) {
    return this.prisma.serviceItem.create({ data: { ...item, workOrderId } });
  }

  async findWithOwner(itemId: number) {
    const item = await this.prisma.serviceItem.findUnique({
      where: { id: itemId },
      include: { quote: { select: { establishmentId: true, workOrderId: true } }, workOrder: { select: { establishmentId: true } } },
    });
    if (!item) return null;
    const establishmentId = item.workOrder?.establishmentId ?? item.quote?.establishmentId ?? null;
    // item ainda só do orçamento, mas o orçamento já virou OS → não se edita mais por ali
    const lockedQuote = !item.workOrderId && !!item.quote?.workOrderId;
    return { item, establishmentId, lockedQuote };
  }

  update(itemId: number, data: Partial<ItemData>) {
    return this.prisma.serviceItem.update({ where: { id: itemId }, data });
  }

  async delete(itemId: number) {
    await this.prisma.serviceItem.delete({ where: { id: itemId } });
  }
}

@Injectable()
export class PrismaPaymentRepository extends PaymentRepository {
  constructor(private readonly prisma: PrismaService) { super(); }

  create(data: { workOrderId: number; method: PaymentMethod; amount: number; paidAt: Date; userId: number }) {
    return this.prisma.payment.create({ data, include: { user: { select: { id: true, name: true } } } });
  }

  async findWithEstablishment(paymentId: number) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { workOrder: { select: { establishmentId: true } } } });
    return payment ? { payment, establishmentId: payment.workOrder.establishmentId } : null;
  }

  async delete(paymentId: number) {
    await this.prisma.payment.delete({ where: { id: paymentId } });
  }

  async sumPaid(establishmentId: number, since: Date, onlyClientId?: number) {
    const agg = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: { paidAt: { gte: since }, workOrder: { establishmentId, ...(onlyClientId ? { clientId: onlyClientId } : {}) } },
    });
    return toNum(agg._sum.amount);
  }

  finishedWithMoney(establishmentId: number, onlyClientId?: number) {
    return this.prisma.workOrder.findMany({
      where: { establishmentId, status: OrderStatus.FINALIZADA, ...(onlyClientId ? { clientId: onlyClientId } : {}) },
      select: { items: true, payments: { select: { amount: true } } },
    });
  }
}

@Injectable()
export class PrismaReviewRepository extends ReviewRepository {
  constructor(private readonly prisma: PrismaService) { super(); }

  create(data: { workOrderId: number; clientId: number; rating: number; comment: string | null }) {
    return this.prisma.review.create({ data });
  }

  async average(establishmentId: number, onlyClientId?: number) {
    const agg = await this.prisma.review.aggregate({
      _avg: { rating: true },
      _count: { _all: true },
      where: { workOrder: { establishmentId, ...(onlyClientId ? { clientId: onlyClientId } : {}) } },
    });
    return { avg: agg._avg.rating, count: agg._count._all };
  }
}

@Injectable()
export class PrismaNoteRepository extends NoteRepository {
  constructor(private readonly prisma: PrismaService) { super(); }

  get(userId: number, establishmentId: number) {
    return this.prisma.userNote.findUnique({ where: { userId_establishmentId: { userId, establishmentId } } });
  }

  save(userId: number, establishmentId: number, content: string) {
    return this.prisma.userNote.upsert({
      where: { userId_establishmentId: { userId, establishmentId } },
      create: { userId, establishmentId, content },
      update: { content },
    });
  }
}
