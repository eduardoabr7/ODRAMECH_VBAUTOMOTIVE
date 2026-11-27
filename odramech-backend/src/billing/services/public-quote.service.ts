import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { QuoteStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';
import { SettingsService } from 'src/settings/services/settings.service';
import { SubscriptionGateway } from 'src/subscription/gateway/subscription.gateway';
import { AppConfig } from 'src/core/config/app-config';
import { serializeItem, sumItems } from 'src/shared/utils/money.util';
import { DocQuote, renderQuoteDocument } from '../document/quote-document.renderer';

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

// O que o cliente vê pelo link do e-mail (sem login). Só muda o status, e só enquanto o
// orçamento está válido e não virou OS.
@Injectable()
export class PublicQuoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionGateway,
    private readonly config: AppConfig,
  ) {}

  /**
   * O link público não passa pelo guard de assinatura (não tem login), então a checagem é aqui:
   * oficina bloqueada não recebe aprovação/recusa nem gera o documento para imprimir.
   */
  private async assertEnterpriseActive(enterpriseId: number) {
    if (this.config.values.subscriptions.enforcement !== 'block') return;
    const decision = await this.subscriptions.access(enterpriseId);
    if (decision.level === 'blocked') {
      throw new HttpException(
        { statusCode: 402, code: 'SUBSCRIPTION_REQUIRED', message: 'Este orçamento está indisponível no momento. Fale diretamente com a oficina.' },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  private async load(token: string) {
    if (!TOKEN.test(token)) throw new NotFoundException('Orçamento não encontrado.');
    const quote = await this.prisma.quote.findUnique({
      where: { publicToken: token },
      include: {
        client: { select: { name: true, email: true, principalPhone: true } },
        vehicle: { select: { plate: true, name: true, make: true } },
        establishment: { select: { name: true, phone: true, email: true, enterpriseId: true } },
        items: { orderBy: { id: 'asc' } },
      },
    });
    if (!quote) throw new NotFoundException('Orçamento não encontrado.');
    return quote;
  }

  private state(q: { status: QuoteStatus; validUntil: Date | null; workOrderId: number | null }) {
    const expired = !!q.validUntil && q.validUntil < new Date();
    const canRespond = !q.workOrderId && !expired && q.status !== QuoteStatus.EXPIRADO;
    return { expired, canRespond };
  }

  async view(token: string) {
    const q = await this.load(token);
    const doc = await this.settings.quoteDocumentFor(q.establishment.enterpriseId, q.establishmentId);
    return {
      numberQuote: q.numberQuote,
      status: q.status,
      createdAt: q.createdAt,
      validUntil: q.validUntil,
      notes: q.notes,
      clientFirstName: q.client.name.trim().split(/\s+/)[0],
      vehicle: q.vehicle,
      items: q.items.map(i => {
        const s = serializeItem(i);
        return { kind: s.kind, description: s.description, quantity: s.quantity, unitPrice: s.unitPrice, discount: s.discount, total: s.total };
      }),
      total: sumItems(q.items),
      convertedToWorkOrder: !!q.workOrderId,
      respondedAt: q.clientRespondedAt,
      ...this.state(q),
      establishment: { name: q.establishment.name, phone: q.establishment.phone, email: q.establishment.email },
      branding: {
        displayName: doc.branding.displayName,
        logoUrl: doc.branding.logoUrl || doc.establishment.logoUrl,
        accentColor: doc.branding.accentColor,
      },
    };
  }

  async document(token: string): Promise<string> {
    const q = await this.load(token);
    await this.assertEnterpriseActive(q.establishment.enterpriseId);
    const doc = await this.settings.quoteDocumentFor(q.establishment.enterpriseId, q.establishmentId);
    const docQuote: DocQuote = { ...q, items: q.items.map(serializeItem) as DocQuote['items'], total: sumItems(q.items) };
    return renderQuoteDocument(docQuote, doc);
  }

  async respond(token: string, approve: boolean) {
    const q = await this.load(token);
    await this.assertEnterpriseActive(q.establishment.enterpriseId);
    const { expired, canRespond } = this.state(q);
    if (q.workOrderId) throw new ConflictException('Este orçamento já foi aprovado e o serviço está em andamento.');
    if (expired || !canRespond) throw new BadRequestException('Este orçamento venceu. Fale com a oficina para receber um novo.');
    await this.prisma.quote.update({
      where: { id: q.id },
      data: { status: approve ? QuoteStatus.APROVADO : QuoteStatus.RECUSADO, clientRespondedAt: new Date() },
    });
    return this.view(token);
  }
}
