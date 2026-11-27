import { Injectable, Logger } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createTransport, Transporter } from 'nodemailer';
import { AppConfig } from 'src/core/config/app-config';
import { PrismaService } from 'src/core/database/prisma.service';
import { SecretBox } from 'src/core/crypto/secret-box';

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
  /** para imagens embutidas no HTML (<img src="cid:...">) */
  cid?: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** nome do remetente quando a empresa não definiu um (ex.: nome da oficina) */
  fromName?: string;
  replyTo?: string | null;
  attachments?: MailAttachment[];
}

export type MailResult =
  | { status: 'ENVIADO'; messageId: string; via: 'EMPRESA' | 'PADRAO'; from: string }
  | { status: 'SIMULADO'; file: string; via: 'PADRAO'; from: string };

/** SMTP pronto para uso (da empresa ou o padrão do Odramech). */
export interface SmtpProfile {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  fromName: string | null;
  fromEmail: string;
}

/**
 * Envio de e-mail por SMTP (nodemailer).
 *
 *  - Empresa com SMTP próprio ativo (Configurações → E-mail de envio): sai pelo servidor dela,
 *    com o remetente dela (ex.: noreply@oficinadojoao.com.br).
 *  - Sem SMTP próprio: sai pelo SMTP padrão do Odramech (.env, ex.: noreply@odramech.com.br).
 *  - Sem SMTP padrão configurado (desenvolvimento): o e-mail é gerado igual e salvo como .eml em
 *    MAIL_OUTBOX_DIR — dá para abrir e conferir — mas não sai de verdade.
 *
 * Se o SMTP próprio da empresa falhar, NÃO cai para o padrão em silêncio: o erro aparece para a
 * oficina corrigir (ela escolheu enviar pelo domínio dela).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly box: SecretBox;
  private defaultTransport: Transporter | null = null;
  /** transportes das empresas, refeitos quando a configuração muda */
  private readonly cache = new Map<number, { stamp: number; transport: Transporter; profile: SmtpProfile }>();

  constructor(private readonly config: AppConfig, private readonly prisma: PrismaService) {
    this.box = new SecretBox(config.values.secretsKey);
  }

  get defaultConfigured(): boolean {
    return !!this.config.values.mail.host;
  }

  /** remetente padrão do Odramech (.env) */
  defaultFrom(): { name: string | null; email: string } {
    const base = this.config.values.mail.from;
    const email = base.match(/<([^>]+)>/)?.[1] ?? base;
    const name = base.includes('<') ? base.slice(0, base.indexOf('<')).trim().replace(/^"|"$/g, '') || null : null;
    return { name, email };
  }

  encryptPassword(plain: string): string { return this.box.encrypt(plain); }
  decryptPassword(box: string | null): string | null { return box ? this.box.decrypt(box) : null; }

  static transportFor(p: SmtpProfile): Transporter {
    return createTransport({
      host: p.host, port: p.port, secure: p.secure,
      auth: p.user ? { user: p.user, pass: p.pass ?? '' } : undefined,
      connectionTimeout: 15_000, greetingTimeout: 10_000, socketTimeout: 30_000,
    });
  }

  /** SMTP próprio ativo da empresa (ou null = usa o padrão) */
  private async enterpriseTransport(enterpriseId: number) {
    const row = await this.prisma.enterpriseMailSettings.findUnique({ where: { enterpriseId } });
    if (!row?.enabled) { this.cache.delete(enterpriseId); return null; }
    const stamp = row.updatedAt.getTime();
    const hit = this.cache.get(enterpriseId);
    if (hit && hit.stamp === stamp) return hit;

    const pass = this.decryptPassword(row.passwordEncrypted);
    if (row.passwordEncrypted && pass === null) {
      throw new Error('A senha do SMTP da empresa não pôde ser lida (a chave SECRETS_KEY mudou). Salve a senha de novo em Configurações → E-mail de envio.');
    }
    const profile: SmtpProfile = {
      host: row.host, port: row.port, secure: row.secure, user: row.username, pass, fromName: row.fromName, fromEmail: row.fromEmail,
    };
    const entry = { stamp, profile, transport: MailService.transportFor(profile) };
    this.cache.set(enterpriseId, entry);
    return entry;
  }

  private def(): Transporter {
    if (this.defaultTransport) return this.defaultTransport;
    const m = this.config.values.mail;
    this.defaultTransport = m.host
      ? MailService.transportFor({ host: m.host, port: m.port, secure: m.secure, user: m.user, pass: m.pass, fromName: null, fromEmail: '' })
      : createTransport({ streamTransport: true, buffer: true, newline: 'windows' });
    return this.defaultTransport;
  }

  static formatFrom(name: string | null | undefined, email: string): string {
    return name ? `"${name.replace(/["\\\r\n]/g, '')}" <${email}>` : email;
  }

  /**
   * O servidor SMTP pode responder "ok" e ainda assim recusar algum destinatário.
   * Confere a lista de recusados e registra a resposta exata (id da mensagem) no log.
   */
  private checkAccepted(info: any, to: string, via: string) {
    const rejected: string[] = (info?.rejected ?? []).map(String);
    if (rejected.length) throw new Error(`O servidor recusou o destinatário ${rejected.join(', ')}: ${info?.response ?? ''}`);
    this.logger.log(`[${via}] aceito para ${mask(to)} — resposta: ${info?.response ?? '—'} — id: ${info?.messageId ?? '—'}`);
  }

  /** envia pelo SMTP da empresa (se houver) ou pelo padrão */
  async send(msg: MailMessage, enterpriseId?: number | null): Promise<MailResult> {
    const own = enterpriseId ? await this.enterpriseTransport(enterpriseId) : null;

    if (own) {
      const from = MailService.formatFrom(own.profile.fromName || msg.fromName, own.profile.fromEmail);
      let info;
      try {
        info = await own.transport.sendMail(this.envelope(msg, from));
      } catch (err) {
        // fica visível na tela de configuração para a oficina corrigir
        await this.prisma.enterpriseMailSettings.update({ where: { enterpriseId: enterpriseId! }, data: { lastError: String((err as Error).message).slice(0, 500) } }).catch(() => undefined);
        throw new Error(`SMTP da empresa (${own.profile.host}): ${(err as Error).message}`);
      }
      this.checkAccepted(info, msg.to, `SMTP da empresa ${enterpriseId}`);
      // voltou a funcionar: limpa o aviso de erro da tela de configuração
      await this.prisma.enterpriseMailSettings.updateMany({ where: { enterpriseId: enterpriseId!, lastError: { not: null } }, data: { lastError: null } }).catch(() => undefined);
      this.logger.log(`E-mail (SMTP da empresa ${enterpriseId}) para ${mask(msg.to)} — ${msg.subject}`);
      return { status: 'ENVIADO', messageId: info.messageId, via: 'EMPRESA', from };
    }

    const d = this.defaultFrom();
    // padrão: "Nome da oficina via Odramech" <noreply@odramech.com.br>
    const from = MailService.formatFrom(msg.fromName ? `${msg.fromName}` : d.name, d.email);
    const info: any = await this.def().sendMail(this.envelope(msg, from));
    if (this.defaultConfigured) {
      this.checkAccepted(info, msg.to, 'SMTP padrão');
      this.logger.log(`E-mail (SMTP padrão) para ${mask(msg.to)} — ${msg.subject}`);
      return { status: 'ENVIADO', messageId: info.messageId, via: 'PADRAO', from };
    }

    const dir = resolve(this.config.values.mail.outboxDir);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${msg.to.replace(/[^a-z0-9@._-]/gi, '_')}.eml`);
    writeFileSync(file, info.message as Buffer);
    this.logger.warn(`SMTP padrão não configurado — e-mail NÃO enviado, salvo em ${file}`);
    return { status: 'SIMULADO', file, via: 'PADRAO', from };
  }

  private envelope(msg: MailMessage, from: string) {
    return {
      from, to: msg.to, replyTo: msg.replyTo ?? undefined, subject: msg.subject,
      html: msg.html, text: msg.text, attachments: msg.attachments,
    };
  }
}

export function mask(email: string): string {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}***@${domain ?? ''}`;
}
