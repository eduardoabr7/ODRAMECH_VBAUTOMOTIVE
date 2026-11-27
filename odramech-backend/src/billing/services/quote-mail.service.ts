import {
  BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit,
} from '@nestjs/common';
import { QuoteEmailKind, QuoteEmailTrigger, QuoteStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { AppConfig } from 'src/core/config/app-config';
import { PrismaService } from 'src/core/database/prisma.service';
import { MailAttachment, MailService } from 'src/mail/mail.service';
import { SettingsService } from 'src/settings/services/settings.service';
import { escapeHtml } from 'src/shared/utils/html.util';
import { serializeItem, sumItems } from 'src/shared/utils/money.util';
import { assertStaff } from 'src/shared/utils/role.util';
import { DocQuote, renderQuoteDocument } from '../document/quote-document.renderer';
import { PdfService } from '../document/pdf.service';

const WORKER_INTERVAL_MS = 30_000;
const DEFAULT_ACCENT = '#e4531c';

const QUOTE_FOR_MAIL = {
  client: { select: { name: true, email: true, principalPhone: true } },
  vehicle: { select: { plate: true, name: true, make: true } },
  establishment: { select: { id: true, name: true, email: true, phone: true, enterpriseId: true } },
  items: { orderBy: { id: 'asc' as const } },
};

export interface SendResult {
  status: 'ENVIADO' | 'SIMULADO';
  to: string;
  kind: QuoteEmailKind;
}

// E-mail do orçamento pro cliente (PDF anexo + link pra aprovar/recusar).
// Cada alteração de conteúdo sobe a versão, e a mesma versão nunca é enviada duas vezes.
// Com envio automático: na criação manda na hora; nas alterações espera 10 min, e cada
// edição nova reinicia a espera pra não mandar um e-mail por edição.
// Sem envio automático só sai pelo botão.
@Injectable()
export class QuoteMailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QuoteMailService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly mail: MailService,
    private readonly pdf: PdfService,
    private readonly config: AppConfig,
  ) {}

  // gatilhos
  /** orçamento criado: com envio automático, manda já */
  async onCreated(quoteId: number, establishmentId: number): Promise<void> {
    const { autoEmailQuote } = await this.settings.quoteSettings(establishmentId);
    if (!autoEmailQuote) return;
    await this.prisma.quote.update({ where: { id: quoteId }, data: { emailPendingAt: new Date() } });
    setImmediate(() => void this.processDue());
  }

  /** conteúdo alterado: nova versão; com envio automático, agenda a atualização (debounce) */
  async onContentChanged(quoteId: number): Promise<void> {
    const quote = await this.prisma.quote.update({
      where: { id: quoteId },
      data: { version: { increment: 1 } },
      select: { establishmentId: true, workOrderId: true },
    });
    if (quote.workOrderId) return;
    const { autoEmailQuote } = await this.settings.quoteSettings(quote.establishmentId);
    if (!autoEmailQuote) return;
    const at = new Date(Date.now() + this.config.values.quoteUpdateEmailDelayMinutes * 60_000);
    await this.prisma.quote.update({ where: { id: quoteId }, data: { emailPendingAt: at } });
  }

  /** botão "Enviar por e-mail" (e "enviar agora" de um envio agendado) */
  async sendManually(auth: AuthPayload, quoteId: number): Promise<SendResult> {
    assertStaff(auth.role);
    const quote = await this.prisma.quote.findFirst({ where: { id: quoteId, establishmentId: auth.establishmentId }, select: { id: true } });
    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    return this.send(quoteId, QuoteEmailTrigger.MANUAL, auth.sub);
  }

  // fila de envios agendados
  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.processDue(), WORKER_INTERVAL_MS);
    this.timer.unref?.();
    setTimeout(() => void this.processDue(), 5_000).unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async processDue(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.prisma.quote.findMany({
        where: { emailPendingAt: { lte: new Date() } },
        select: { id: true },
        take: 20,
      });
      for (const { id } of due) {
        // "reserva" o envio: se outra execução já pegou, pula
        const claimed = await this.prisma.quote.updateMany({ where: { id, emailPendingAt: { lte: new Date() } }, data: { emailPendingAt: null } });
        if (!claimed.count) continue;
        try {
          await this.send(id, QuoteEmailTrigger.AUTOMATICO, null);
        } catch (err) {
          this.logger.warn(`Envio automático do orçamento ${id} não feito: ${(err as Error).message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  // envio
  private async send(quoteId: number, trigger: QuoteEmailTrigger, userId: number | null): Promise<SendResult> {
    const quote = await this.prisma.quote.findUnique({ where: { id: quoteId }, include: QUOTE_FOR_MAIL });
    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    if (quote.workOrderId) throw new ConflictException('Orçamento já convertido em OS — não é mais enviado ao cliente.');
    if (quote.emailSentVersion === quote.version) {
      await this.prisma.quote.update({ where: { id: quoteId }, data: { emailPendingAt: null } });
      throw new ConflictException('Esta versão do orçamento já foi enviada ao cliente. Altere o orçamento para enviar uma atualização.');
    }
    const to = quote.client.email?.trim();
    if (!to) throw new BadRequestException('O cliente não tem e-mail cadastrado.');
    if (!quote.items.length) throw new BadRequestException('O orçamento não tem itens.');

    const kind = quote.emailSentAt ? QuoteEmailKind.ATUALIZACAO : QuoteEmailKind.ENVIO;
    const token = quote.publicToken ?? randomBytes(24).toString('base64url');
    const doc = await this.settings.quoteDocumentFor(quote.establishment.enterpriseId, quote.establishmentId);

    const docQuote: DocQuote = {
      ...quote,
      items: quote.items.map(serializeItem) as DocQuote['items'],
      total: sumItems(quote.items),
    };

    try {
      const pdf = await this.pdf.fromHtml(renderQuoteDocument(docQuote, doc));
      const { html, text, attachments } = this.compose(kind, docQuote, doc, token);
      const brand = doc.branding.displayName || quote.establishment.name;
      const result = await this.mail.send({
        to,
        fromName: brand,
        replyTo: quote.establishment.email,
        subject: kind === QuoteEmailKind.ENVIO
          ? `Orçamento nº ${quote.numberQuote} — ${quote.establishment.name}`
          : `Seu orçamento nº ${quote.numberQuote} foi atualizado — ${quote.establishment.name}`,
        html,
        text,
        attachments: [...attachments, { filename: `orcamento-${quote.numberQuote}.pdf`, content: pdf, contentType: 'application/pdf' }],
      }, quote.establishment.enterpriseId);

      // uma resposta anterior do cliente vale para a versão antiga: volta a "Enviado"
      const answered = quote.status === QuoteStatus.APROVADO || quote.status === QuoteStatus.RECUSADO;
      await this.prisma.$transaction([
        this.prisma.quote.update({
          where: { id: quoteId },
          data: {
            publicToken: token,
            emailSentAt: new Date(),
            emailSentVersion: quote.version,
            emailPendingAt: null,
            ...((quote.status === QuoteStatus.RASCUNHO || (kind === QuoteEmailKind.ATUALIZACAO && answered)) && { status: QuoteStatus.ENVIADO, clientRespondedAt: null }),
          },
        }),
        this.prisma.quoteEmail.create({
          data: { quoteId, version: quote.version, kind, trigger, status: result.status, toEmail: to, userId },
        }),
      ]);
      return { status: result.status, to, kind };
    } catch (err) {
      const message = (err as Error).message?.slice(0, 500) ?? 'Erro desconhecido';
      await this.prisma.quoteEmail.create({
        data: { quoteId, version: quote.version, kind, trigger, status: 'FALHOU', toEmail: to, error: message, userId },
      });
      if (err instanceof BadRequestException || err instanceof ConflictException) throw err;
      this.logger.error(`Falha ao enviar orçamento ${quoteId}: ${message}`);
      throw new BadRequestException(`Não foi possível enviar o e-mail: ${message}`);
    }
  }

  // conteúdo do e-mail
  private compose(kind: QuoteEmailKind, q: DocQuote, doc: Awaited<ReturnType<SettingsService['quoteDocumentFor']>>, token: string) {
    const accent = /^#[0-9a-f]{6}$/i.test(doc.branding.accentColor ?? '') ? doc.branding.accentColor! : DEFAULT_ACCENT;
    const estab = doc.establishment;
    const brand = doc.branding.displayName || estab.name;
    const firstName = q.client.name.trim().split(/\s+/)[0];
    const vehicle = `${q.vehicle.make} ${q.vehicle.name}`.trim();
    const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const validUntil = q.validUntil ? new Date(q.validUntil).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : null;
    const link = `${this.config.values.publicAppUrl}/orcamento/${token}`;

    // logo vai como anexo (cid), a maioria dos clientes de e-mail bloqueia data URL em <img>
    const attachments: MailAttachment[] = [];
    let logoTag = '';
    const logo = doc.branding.logoUrl || estab.logoUrl;
    const m = logo?.match(/^data:(image\/(?:png|jpe?g|gif|webp));base64,(.+)$/);
    if (m) {
      attachments.push({ filename: 'logo', content: Buffer.from(m[2], 'base64'), contentType: m[1], cid: 'logo@orcamento' });
      logoTag = `<img src="cid:logo@orcamento" alt="" height="40" style="display:block;max-height:40px;max-width:140px;margin-bottom:10px">`;
    }

    const isUpdate = kind === QuoteEmailKind.ATUALIZACAO;
    const title = isUpdate ? `Seu orçamento nº ${q.numberQuote} foi atualizado` : `Seu orçamento nº ${q.numberQuote} está pronto`;
    const intro = isUpdate
      ? `Olá, ${escapeHtml(firstName)}! Fizemos alterações no orçamento do seu <b>${escapeHtml(vehicle)}</b>. Esta versão substitui a anterior — se você já tinha respondido, confira e responda de novo.`
      : `Olá, ${escapeHtml(firstName)}! Segue o orçamento para o seu <b>${escapeHtml(vehicle)}</b> (placa ${escapeHtml(q.vehicle.plate)}). O documento completo está em PDF, em anexo.`;

    const rows = q.items.slice(0, 8).map(i => `
      <tr><td style="padding:6px 0;color:#3b3a37;font-size:14px">${escapeHtml(i.description)}${i.quantity !== 1 ? ` <span style="color:#8a877f">× ${i.quantity}</span>` : ''}</td>
      <td style="padding:6px 0;text-align:right;white-space:nowrap;font-size:14px;color:#151515">${money(i.total)}</td></tr>`).join('');
    const more = q.items.length > 8 ? `<tr><td colspan="2" style="padding:6px 0;color:#8a877f;font-size:13px">+ ${q.items.length - 8} item(ns) no PDF</td></tr>` : '';

    const button = (href: string, label: string, primary: boolean) =>
      `<a href="${href}" style="display:inline-block;padding:12px 22px;margin:4px 6px 4px 0;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;${primary ? `background:${accent};color:#ffffff` : 'background:#ffffff;color:#151515;border:1px solid #d4d1c9'}">${label}</a>`;

    const contact = [estab.phone && `Telefone ${escapeHtml(estab.phone)}`, estab.email && escapeHtml(estab.email)].filter(Boolean).join(' · ');

    const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#f3f2ee;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#151515">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f2ee;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e3dd">
  <tr><td style="height:4px;background:${accent}"></td></tr>
  <tr><td style="padding:28px 28px 8px">
    ${logoTag}<div style="font-size:13px;color:#7a7871;text-transform:uppercase;letter-spacing:.08em">${escapeHtml(brand)}</div>
    <h1 style="font-size:22px;line-height:1.25;margin:8px 0 12px;color:#151515">${title}</h1>
    <p style="font-size:15px;line-height:1.55;color:#3b3a37;margin:0">${intro}</p>
  </td></tr>
  <tr><td style="padding:18px 28px 6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e3dd;border-bottom:1px solid #e5e3dd">${rows}${more}
      <tr><td style="padding:12px 0 10px;font-weight:700;font-size:16px;border-top:1px solid #e5e3dd">Total</td>
      <td style="padding:12px 0 10px;text-align:right;font-weight:700;font-size:18px;color:${accent};border-top:1px solid #e5e3dd">${money(q.total)}</td></tr>
    </table>
    ${validUntil ? `<p style="font-size:13px;color:#7a7871;margin:10px 0 0">Válido até <b style="color:#3b3a37">${validUntil}</b></p>` : ''}
  </td></tr>
  <tr><td style="padding:18px 28px 8px">
    <p style="font-size:14px;color:#3b3a37;margin:0 0 10px">Podemos seguir com o serviço?</p>
    ${button(`${link}?acao=aprovar`, 'Aprovar orçamento', true)}${button(`${link}?acao=recusar`, 'Recusar', false)}
    <p style="font-size:13px;margin:12px 0 0"><a href="${link}" style="color:${accent}">Ver orçamento completo</a></p>
  </td></tr>
  <tr><td style="padding:18px 28px 26px;font-size:12px;color:#8a877f;line-height:1.5;border-top:1px solid #f0eee9">
    Dúvidas? Responda este e-mail ou fale com a <b>${escapeHtml(estab.name)}</b>${contact ? ` — ${contact}` : ''}.
  </td></tr>
</table></td></tr></table></body></html>`;

    const text = [
      title, '',
      `Olá, ${firstName}!`,
      isUpdate ? `Fizemos alterações no orçamento do seu ${vehicle}. Esta versão substitui a anterior.` : `Segue o orçamento para o seu ${vehicle} (PDF em anexo).`,
      '', ...q.items.map(i => `- ${i.description}: ${money(i.total)}`), '',
      `Total: ${money(q.total)}`, validUntil ? `Válido até ${validUntil}` : '', '',
      `Aprovar: ${link}?acao=aprovar`, `Recusar: ${link}?acao=recusar`, `Ver orçamento: ${link}`, '',
      `${estab.name}${contact ? ` — ${contact.replace(/<[^>]+>/g, '')}` : ''}`,
    ].join('\n');

    return { html, text, attachments };
  }
}
