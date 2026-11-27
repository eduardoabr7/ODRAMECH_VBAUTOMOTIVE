import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { QuoteStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { assertStaff, isStaff } from 'src/shared/utils/role.util';
import { serializeItem, sumItems } from 'src/shared/utils/money.util';
import { escapeHtml } from 'src/shared/utils/html.util';
import { QuoteRepository, QuoteScope, ServiceItemRepository } from '../repositories/billing.repositories';
import { ServiceItemFactory } from '../factories/service-item.factory';
import { QuoteCreateDTO, QuoteListQueryDTO, QuoteUpdateDTO, ServiceItemDTO } from '../dto/billing.dto';

/** Casos de uso de orçamento. */
@Injectable()
export class QuoteService {
  constructor(
    private readonly quotes: QuoteRepository,
    private readonly items: ServiceItemRepository,
    private readonly prisma: PrismaService,
  ) {}

  private scope(auth: AuthPayload): QuoteScope {
    return { establishmentId: auth.establishmentId, ...(isStaff(auth.role) ? {} : { onlyClientId: auth.sub }) };
  }

  private serialize<T extends { items: any[] }>(quote: T) {
    return { ...quote, items: quote.items.map(serializeItem), total: sumItems(quote.items) };
  }

  async list(auth: AuthPayload, q: QuoteListQueryDTO) {
    const rows = await this.quotes.list({ ...this.scope(auth), status: q.status, term: q.search?.trim() || undefined }, 200);
    return rows.map(r => this.serialize(r));
  }

  async get(auth: AuthPayload, id: number) {
    const quote = await this.quotes.findOne(this.scope(auth), id);
    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    return this.serialize(quote);
  }

  async create(auth: AuthPayload, dto: QuoteCreateDTO) {
    assertStaff(auth.role);
    await this.assertClientOwnsVehicle(auth.establishmentId, dto.clientId, dto.vehicleId);

    const { id } = await this.quotes.create({
      establishmentId: auth.establishmentId,
      clientId: dto.clientId,
      vehicleId: dto.vehicleId,
      userCreationId: auth.sub,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      notes: dto.notes?.trim() || null,
      items: dto.items.map(ServiceItemFactory.create),
    });
    return this.get(auth, id);
  }

  async update(auth: AuthPayload, id: number, dto: QuoteUpdateDTO) {
    const quote = await this.editable(auth, id, { allowConverted: dto.status === undefined || dto.status === QuoteStatus.APROVADO });
    if (quote.workOrderId && dto.status && dto.status !== QuoteStatus.APROVADO) {
      throw new ConflictException('Orçamento já convertido em OS.');
    }
    await this.quotes.update(id, {
      ...(dto.status && { status: dto.status }),
      ...(dto.validUntil !== undefined && { validUntil: dto.validUntil ? new Date(dto.validUntil) : null }),
      ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
    });
    return this.get(auth, id);
  }

  async addItem(auth: AuthPayload, id: number, dto: ServiceItemDTO) {
    await this.editable(auth, id);
    await this.items.addToQuote(id, ServiceItemFactory.create(dto));
    return this.get(auth, id);
  }

  /** Aprova e abre a OS com os mesmos itens. */
  async convert(auth: AuthPayload, id: number) {
    const quote = await this.editable(auth, id);
    if (quote.status === QuoteStatus.RECUSADO || quote.status === QuoteStatus.EXPIRADO) {
      throw new ConflictException('Orçamentos recusados ou expirados não podem virar OS.');
    }
    if (!quote.items.length) throw new BadRequestException('O orçamento não tem itens.');

    const note = `<p>OS aberta a partir do <b>orçamento #${quote.numberQuote}</b>.</p>${quote.notes ? `<p>${escapeHtml(quote.notes)}</p>` : ''}`;
    const wo = await this.quotes.convertToWorkOrder(id, auth.sub, note);
    return { workOrderId: wo.id, numberOs: wo.numberOs };
  }

  private async editable(auth: AuthPayload, id: number, opts: { allowConverted?: boolean } = {}) {
    assertStaff(auth.role);
    const quote = await this.quotes.findOne({ establishmentId: auth.establishmentId }, id);
    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    if (quote.workOrderId && !opts.allowConverted) {
      throw new ConflictException('Orçamento já convertido em OS — edite os itens na própria OS.');
    }
    return quote;
  }

  private async assertClientOwnsVehicle(establishmentId: number, clientId: number, vehicleId: number) {
    const [client, link] = await Promise.all([
      this.prisma.userCorporation.findFirst({ where: { idUser: clientId, idEstablishment: establishmentId }, select: { idUser: true } }),
      this.prisma.userVehicle.findUnique({ where: { userId_vehicleId: { userId: clientId, vehicleId } } }),
    ]);
    if (!client) throw new BadRequestException('Cliente não pertence a este estabelecimento.');
    if (!link) throw new BadRequestException('O veículo não está vinculado a este cliente.');
  }
}
