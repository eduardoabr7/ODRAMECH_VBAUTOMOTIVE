import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { assertStaff, isStaff } from 'src/shared/utils/role.util';
import { serializeItem, toNum } from 'src/shared/utils/money.util';
import { WorkOrderRepository } from 'src/work-order/repositories/work-order.repository';
import { PaymentRepository, ReviewRepository, ServiceItemRepository } from '../repositories/billing.repositories';
import { ServiceItemFactory } from '../factories/service-item.factory';
import { QuoteMailService } from './quote-mail.service';
import { FinancialReportBuilder } from '../reports/financial-report.builder';
import { PaymentDTO, ReviewDTO, ServiceItemDTO, UpdateServiceItemDTO } from '../dto/billing.dto';
import { ItemStockPolicy } from 'src/inventory/item-stock.policy';
import { DomainEventBus } from 'src/core/events/domain-event-bus';
import { WorkOrderContentChanged } from 'src/work-order/domain/work-order.events';

/** Itens, pagamentos e avaliação de uma OS. */
@Injectable()
export class WorkOrderMoneyService {
  constructor(
    private readonly workOrders: WorkOrderRepository,
    private readonly items: ServiceItemRepository,
    private readonly payments: PaymentRepository,
    private readonly reviews: ReviewRepository,
    private readonly quoteMail: QuoteMailService,
    private readonly stock: ItemStockPolicy,
    private readonly events: DomainEventBus,
  ) {}

  /** quem está com a OS aberta recebe o aviso "Recarregar" */
  private touched(workOrderId: number | null | undefined, auth: AuthPayload) {
    if (workOrderId) return this.events.publish(new WorkOrderContentChanged(workOrderId, auth.sub));
  }

  private async openWorkOrder(auth: AuthPayload, id: number) {
    const wo = await this.workOrders.findRef(id, auth.establishmentId);
    if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');
    if (wo.status === OrderStatus.CANCELADA) throw new ConflictException('OS cancelada não aceita alterações financeiras.');
    return wo;
  }

  // ── Itens ───────────────────────────────────────────────
  async addItem(auth: AuthPayload, workOrderId: number, dto: ServiceItemDTO) {
    assertStaff(auth.role);
    await this.openWorkOrder(auth, workOrderId);
    const data = ServiceItemFactory.create(dto);
    const ctx = await this.stock.context(auth);
    if (data.partId) await this.stock.assertLinkable(auth, ctx, data.partId, data.kind);
    const created = serializeItem(await this.items.addToWorkOrder(workOrderId, data, ctx));
    await this.touched(workOrderId, auth);
    return created;
  }

  async updateItem(auth: AuthPayload, itemId: number, dto: UpdateServiceItemDTO) {
    const { item } = await this.ownedItem(auth, itemId);
    const patch = ServiceItemFactory.patch(item, dto);
    const ctx = await this.stock.context(auth);
    // vincular uma peça nova passa pelas regras do módulo; manter a mesma não
    if (patch.partId && patch.partId !== item.partId) await this.stock.assertLinkable(auth, ctx, patch.partId, patch.kind!);
    const updated = serializeItem(await this.items.update(itemId, patch, ctx));
    await this.quoteChanged(item);
    await this.touched(item.workOrderId, auth);
    return updated;
  }

  async deleteItem(auth: AuthPayload, itemId: number) {
    const { item } = await this.ownedItem(auth, itemId);
    await this.items.delete(itemId, await this.stock.context(auth));
    await this.quoteChanged(item);
    await this.touched(item.workOrderId, auth);
    return { deleted: true };
  }

  // mudou item de um orçamento que ainda não é OS: nova versão pro cliente
  private async quoteChanged(item: { quoteId: number | null; workOrderId: number | null }) {
    if (item.quoteId && !item.workOrderId) await this.quoteMail.onContentChanged(item.quoteId);
  }

  private async ownedItem(auth: AuthPayload, itemId: number) {
    assertStaff(auth.role);
    const found = await this.items.findWithOwner(itemId);
    if (!found || found.establishmentId !== auth.establishmentId) throw new NotFoundException('Item não encontrado');
    if (found.lockedQuote) throw new ConflictException('Orçamento já convertido em OS — edite os itens na própria OS.');
    return found;
  }

  // ── Pagamentos ──────────────────────────────────────────
  async addPayment(auth: AuthPayload, workOrderId: number, dto: PaymentDTO) {
    assertStaff(auth.role);
    await this.openWorkOrder(auth, workOrderId);
    const payment = await this.payments.create({
      workOrderId,
      method: dto.method,
      amount: dto.amount,
      paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
      userId: auth.sub,
    });
    await this.touched(workOrderId, auth);
    return { ...payment, amount: toNum(payment.amount) };
  }

  async deletePayment(auth: AuthPayload, paymentId: number) {
    assertStaff(auth.role);
    const found = await this.payments.findWithEstablishment(paymentId);
    if (!found || found.establishmentId !== auth.establishmentId) throw new NotFoundException('Pagamento não encontrado');

    const isManager = auth.role === Role.ADMIN || auth.role === Role.SUPERUSER;
    if (!isManager && found.payment.userId !== auth.sub) {
      throw new ForbiddenException('Só quem registrou ou um administrador pode estornar este pagamento.');
    }
    await this.payments.delete(paymentId);
    await this.touched(found.payment.workOrderId, auth);
    return { deleted: true };
  }

  // ── Avaliação ───────────────────────────────────────────
  async review(auth: AuthPayload, workOrderId: number, dto: ReviewDTO) {
    const detail = await this.workOrders.findDetail({ establishmentId: auth.establishmentId, onlyClientId: auth.sub }, workOrderId, false);
    if (!detail) throw new NotFoundException('Ordem de serviço não encontrada para este cliente.');
    if (detail.status !== OrderStatus.FINALIZADA) throw new ConflictException('Só é possível avaliar serviços finalizados.');
    if (detail.review) throw new ConflictException('Este serviço já foi avaliado.');

    const review = await this.reviews.create({ workOrderId, clientId: auth.sub, rating: dto.rating, comment: dto.comment?.trim() || null });
    await this.touched(workOrderId, auth);
    return review;
  }

  // ── Relatório ───────────────────────────────────────────
  financialReport(auth: AuthPayload) {
    return new FinancialReportBuilder(this.payments, this.reviews, {
      establishmentId: auth.establishmentId,
      ...(isStaff(auth.role) ? {} : { onlyClientId: auth.sub }),
    })
      .withRevenue()
      .withReceivables()
      .withRatings()
      .build();
  }
}
