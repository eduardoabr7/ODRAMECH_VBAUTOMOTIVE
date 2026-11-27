import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { QuoteTemplate } from '@prisma/client';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { PrismaService } from 'src/core/database/prisma.service';
import { sanitizeHtml } from 'src/shared/utils/html.util';
import { assertManager } from 'src/shared/utils/role.util';
import { PlanFeature } from 'src/subscription/gateway/subscription.gateway';
import { PlanEntitlementsService } from 'src/subscription/plan-entitlements.service';
import { BrandingDTO, QuoteDocumentPreviewDTO, QuoteDocumentSettingsDTO } from '../dto/settings.dto';
import { CUSTOM_STARTER, renderQuoteDocument, sampleQuote, TEMPLATE_VARIABLES } from 'src/billing/document/quote-document.renderer';

const DEFAULT_QUOTE_SETTINGS = {
  quoteTemplate: QuoteTemplate.ODRAMECH,
  quoteHeaderHtml: null as string | null,
  quoteBodyHtml: null as string | null,
  quoteFooterHtml: null as string | null,
  quoteValidityDays: 15,
  markQuoteSentOnPrint: false,
  autoEmailQuote: false,
};

/**
 * Configurações do estabelecimento (documento de orçamento) e da empresa (tema/marca).
 * Recursos pagos são checados aqui, no servidor — o frontend só esconde/mostra.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService, private readonly entitlements: PlanEntitlementsService) {}

  // ═══ Documento de orçamento ═════════════════════════════
  async quoteSettings(establishmentId: number) {
    const row = await this.prisma.establishmentSettings.findUnique({ where: { establishmentId } });
    const { establishmentId: _id, updatedAt: _u, ...values } = row ?? { establishmentId, updatedAt: null, ...DEFAULT_QUOTE_SETTINGS };
    return values;
  }

  /** tudo que a tela/impressão do orçamento precisa: configuração + dados do estabelecimento + marca */
  quoteDocument(auth: AuthPayload) {
    return this.quoteDocumentFor(auth.enterpriseId, auth.establishmentId);
  }

  /** mesma coisa, sem sessão (envio automático de e-mail roda em segundo plano) */
  async quoteDocumentFor(enterpriseId: number, establishmentId: number) {
    const auth = { enterpriseId, establishmentId };
    const [settings, establishment, branding, canCustomize] = await Promise.all([
      this.quoteSettings(auth.establishmentId),
      this.prisma.establishment.findUnique({
        where: { id: auth.establishmentId },
        select: { id: true, name: true, cnpj: true, phone: true, email: true, logoUrl: true, address: true, enterprise: { select: { name: true } } },
      }),
      this.prisma.enterpriseBranding.findUnique({ where: { enterpriseId: auth.enterpriseId }, select: { displayName: true, logoUrl: true, accentColor: true } }),
      this.entitlements.has(auth.enterpriseId, PlanFeature.QUOTE_DOCUMENT_EDITOR),
    ]);
    if (!establishment) throw new NotFoundException('Estabelecimento não encontrado.');

    const { enterprise, ...est } = establishment;
    // sem o recurso no plano, um modelo personalizado salvo antes volta a imprimir no padrão
    const effectiveTemplate = settings.quoteTemplate === QuoteTemplate.CUSTOM && !canCustomize ? QuoteTemplate.ODRAMECH : settings.quoteTemplate;
    return {
      settings: { ...settings, effectiveTemplate },
      establishment: { ...est, enterpriseName: enterprise.name },
      branding: branding ?? { displayName: null, logoUrl: null, accentColor: null },
      canCustomize,
      /** variáveis aceitas no modelo personalizado e o modelo inicial do editor */
      templateVariables: TEMPLATE_VARIABLES,
      customStarter: CUSTOM_STARTER,
    };
  }

  /** HTML do documento com um orçamento de exemplo e a configuração ainda não salva */
  async previewQuoteDocument(auth: AuthPayload, dto: QuoteDocumentPreviewDTO): Promise<string> {
    const doc = await this.quoteDocument(auth);
    const custom = dto.quoteTemplate === QuoteTemplate.CUSTOM && doc.canCustomize;
    const draft = {
      ...doc,
      settings: {
        ...doc.settings,
        effectiveTemplate: custom || dto.quoteTemplate !== QuoteTemplate.CUSTOM ? dto.quoteTemplate : QuoteTemplate.ODRAMECH,
        quoteHeaderHtml: sanitizeHtml(dto.quoteHeaderHtml),
        quoteBodyHtml: sanitizeHtml(dto.quoteBodyHtml),
        quoteFooterHtml: sanitizeHtml(dto.quoteFooterHtml),
      },
    };
    return renderQuoteDocument(sampleQuote(dto.quoteValidityDays ?? doc.settings.quoteValidityDays), draft);
  }

  async saveQuoteSettings(auth: AuthPayload, dto: QuoteDocumentSettingsDTO) {
    assertManager(auth.role);
    const editsHtml = dto.quoteTemplate === QuoteTemplate.CUSTOM
      || dto.quoteHeaderHtml !== undefined || dto.quoteBodyHtml !== undefined || dto.quoteFooterHtml !== undefined;
    if (editsHtml) {
      await this.entitlements.assertFeature(auth.enterpriseId, PlanFeature.QUOTE_DOCUMENT_EDITOR, 'Editar o documento do orçamento');
    }

    const data = {
      ...(dto.quoteTemplate !== undefined && { quoteTemplate: dto.quoteTemplate }),
      ...(dto.quoteHeaderHtml !== undefined && { quoteHeaderHtml: sanitizeHtml(dto.quoteHeaderHtml) }),
      ...(dto.quoteBodyHtml !== undefined && { quoteBodyHtml: sanitizeHtml(dto.quoteBodyHtml) }),
      ...(dto.quoteFooterHtml !== undefined && { quoteFooterHtml: sanitizeHtml(dto.quoteFooterHtml) }),
      ...(dto.quoteValidityDays !== undefined && { quoteValidityDays: dto.quoteValidityDays }),
      ...(dto.markQuoteSentOnPrint !== undefined && { markQuoteSentOnPrint: dto.markQuoteSentOnPrint }),
      ...(dto.autoEmailQuote !== undefined && { autoEmailQuote: dto.autoEmailQuote }),
    };
    await this.prisma.establishmentSettings.upsert({
      where: { establishmentId: auth.establishmentId },
      create: { establishmentId: auth.establishmentId, ...data },
      update: data,
    });
    return this.quoteDocument(auth);
  }

  // ═══ Tema / marca ═══════════════════════════════════════
  private async brandingRow(enterpriseId: number) {
    return this.prisma.enterpriseBranding.findUnique({ where: { enterpriseId } });
  }

  /** tema da empresa da sessão (todos os usuários: o layout usa para logo/nome/cor) */
  async branding(auth: AuthPayload) {
    const [row, enterprise, canCustomizeLogin] = await Promise.all([
      this.brandingRow(auth.enterpriseId),
      this.prisma.enterprise.findUnique({ where: { id: auth.enterpriseId }, select: { name: true } }),
      this.entitlements.has(auth.enterpriseId, PlanFeature.LOGIN_CUSTOMIZATION),
    ]);
    return {
      enterpriseName: enterprise?.name ?? null,
      publicKey: row?.publicKey ?? null,
      displayName: row?.displayName ?? null,
      logoUrl: row?.logoUrl ?? null,
      accentColor: row?.accentColor ?? null,
      loginImageUrl: row?.loginImageUrl ?? null,
      loginHeadline: row?.loginHeadline ?? null,
      loginSubtitle: row?.loginSubtitle ?? null,
      canCustomizeLogin,
    };
  }

  async saveBranding(auth: AuthPayload, dto: BrandingDTO) {
    assertManager(auth.role);
    const touchesLogin = dto.loginImageUrl !== undefined || dto.loginHeadline !== undefined || dto.loginSubtitle !== undefined;
    const clearsLoginOnly = touchesLogin && [dto.loginImageUrl, dto.loginHeadline, dto.loginSubtitle].every(v => v === undefined || v === null);
    if (touchesLogin && !clearsLoginOnly) {
      await this.entitlements.assertFeature(auth.enterpriseId, PlanFeature.LOGIN_CUSTOMIZATION, 'Personalizar a tela de login');
    }

    const clean = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
    const data = {
      ...(dto.displayName !== undefined && { displayName: clean(dto.displayName) }),
      ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
      ...(dto.accentColor !== undefined && { accentColor: dto.accentColor?.toLowerCase() ?? null }),
      ...(dto.loginImageUrl !== undefined && { loginImageUrl: dto.loginImageUrl }),
      ...(dto.loginHeadline !== undefined && { loginHeadline: clean(dto.loginHeadline) }),
      ...(dto.loginSubtitle !== undefined && { loginSubtitle: clean(dto.loginSubtitle) }),
    };
    await this.prisma.enterpriseBranding.upsert({
      where: { enterpriseId: auth.enterpriseId },
      create: { enterpriseId: auth.enterpriseId, ...data },
      update: data,
    });
    return this.branding(auth);
  }

  /**
   * Tema público para a tela de login (antes de entrar).
   * Logo/nome/cor valem para todos os planos; imagem e textos do login só com o recurso no plano.
   */
  async publicBranding(publicKey: string) {
    if (!/^[0-9a-f-]{36}$/i.test(publicKey)) throw new BadRequestException('Chave inválida.');
    const row = await this.prisma.enterpriseBranding.findUnique({ where: { publicKey } });
    if (!row) throw new NotFoundException('Tema não encontrado.');
    const enterprise = await this.prisma.enterprise.findUnique({ where: { id: row.enterpriseId }, select: { name: true } });
    const login = await this.entitlements.has(row.enterpriseId, PlanFeature.LOGIN_CUSTOMIZATION);
    return {
      displayName: row.displayName ?? enterprise?.name ?? null,
      logoUrl: row.logoUrl,
      accentColor: row.accentColor,
      loginImageUrl: login ? row.loginImageUrl : null,
      loginHeadline: login ? row.loginHeadline : null,
      loginSubtitle: login ? row.loginSubtitle : null,
    };
  }
}
