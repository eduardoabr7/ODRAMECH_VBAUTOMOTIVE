import { BadRequestException, Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { AppConfig } from 'src/core/config/app-config';
import { PrismaService } from 'src/core/database/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { assertManager } from 'src/shared/utils/role.util';
import { MailSettingsDTO, MailTestDTO } from '../dto/mail-settings.dto';

/**
 * Configurações → E-mail de envio: SMTP próprio da EMPRESA.
 *
 * Por que por empresa (e não por estabelecimento): o remetente é a marca/domínio
 * (noreply@oficinadojoao.com.br) e normalmente é um só para todas as unidades. O "responder para"
 * de cada e-mail continua sendo o e-mail do estabelecimento que fez o orçamento.
 */
@Injectable()
export class MailSettingsService {
  constructor(private readonly prisma: PrismaService, private readonly mail: MailService, private readonly config: AppConfig) {}

  async get(auth: AuthPayload) {
    assertManager(auth.role);
    const row = await this.prisma.enterpriseMailSettings.findUnique({ where: { enterpriseId: auth.enterpriseId } });
    const d = this.mail.defaultFrom();
    return {
      settings: row && {
        enabled: row.enabled, host: row.host, port: row.port, secure: row.secure, username: row.username,
        hasPassword: !!row.passwordEncrypted, fromName: row.fromName, fromEmail: row.fromEmail,
        verifiedAt: row.verifiedAt, lastError: row.lastError, updatedAt: row.updatedAt,
      },
      /** usado quando a empresa não tem SMTP próprio ativo */
      fallback: { fromEmail: d.email, configured: this.mail.defaultConfigured },
    };
  }

  async save(auth: AuthPayload, dto: MailSettingsDTO) {
    assertManager(auth.role);
    await this.assertSafeHost(dto.host);
    const password = dto.password === undefined ? undefined : dto.password ? this.mail.encryptPassword(dto.password) : null;
    const data = {
      enabled: dto.enabled,
      host: dto.host.trim().toLowerCase(),
      port: dto.port,
      secure: dto.secure,
      username: dto.username?.trim() || null,
      fromName: dto.fromName?.trim() || null,
      fromEmail: dto.fromEmail.trim().toLowerCase(),
      ...(password !== undefined && { passwordEncrypted: password }),
    };
    const before = await this.prisma.enterpriseMailSettings.findUnique({ where: { enterpriseId: auth.enterpriseId } });
    const serverChanged = !before || before.host !== data.host || before.port !== data.port || before.secure !== data.secure
      || before.username !== data.username || before.fromEmail !== data.fromEmail || password !== undefined;
    await this.prisma.enterpriseMailSettings.upsert({
      where: { enterpriseId: auth.enterpriseId },
      create: { enterpriseId: auth.enterpriseId, ...data },
      // mudou o servidor/credenciais: o teste anterior não vale mais
      update: { ...data, ...(serverChanged && { verifiedAt: null, lastError: null }) },
    });
    return this.get(auth);
  }

  /** manda um e-mail de teste com os dados do formulário (salvos ou não) */
  async test(auth: AuthPayload, dto: MailTestDTO) {
    assertManager(auth.role);
    await this.assertSafeHost(dto.host);
    const saved = await this.prisma.enterpriseMailSettings.findUnique({ where: { enterpriseId: auth.enterpriseId } });
    const pass = dto.password !== undefined ? dto.password || null : this.mail.decryptPassword(saved?.passwordEncrypted ?? null);
    const user = await this.prisma.user.findUnique({ where: { id: auth.sub }, select: { email: true } });
    const to = dto.to || user?.email;
    if (!to) throw new BadRequestException('Informe para qual e-mail mandar o teste.');

    const transport = MailService.transportFor({
      host: dto.host, port: dto.port, secure: dto.secure, user: dto.username || null, pass, fromName: dto.fromName ?? null, fromEmail: dto.fromEmail,
    });
    const sameAsSaved = !!saved && saved.host === dto.host.trim().toLowerCase() && saved.port === dto.port
      && saved.secure === dto.secure && (saved.username ?? null) === (dto.username?.trim() || null)
      && saved.fromEmail === dto.fromEmail.trim().toLowerCase() && dto.password === undefined;
    try {
      await transport.verify();
      await transport.sendMail({
        from: MailService.formatFrom(dto.fromName, dto.fromEmail),
        to,
        subject: 'Teste de e-mail — Odramech',
        text: `Funcionou! Os orçamentos desta empresa serão enviados por ${dto.fromEmail} (servidor ${dto.host}:${dto.port}).`,
        html: `<p style="font-family:Segoe UI,Arial,sans-serif;font-size:15px">Funcionou! ✅</p>
<p style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#555">Os orçamentos desta empresa serão enviados por <b>${dto.fromEmail}</b> (servidor ${dto.host}:${dto.port}).</p>`,
      });
      if (sameAsSaved) await this.prisma.enterpriseMailSettings.update({ where: { enterpriseId: auth.enterpriseId }, data: { verifiedAt: new Date(), lastError: null } });
      return { ok: true, to };
    } catch (err) {
      const message = friendly((err as any)?.code, (err as Error).message);
      if (sameAsSaved) await this.prisma.enterpriseMailSettings.update({ where: { enterpriseId: auth.enterpriseId }, data: { lastError: message.slice(0, 500) } });
      throw new BadRequestException(message);
    } finally {
      transport.close();
    }
  }

  /**
   * Em produção, não deixa apontar o SMTP para a rede interna do servidor (evita usar o
   * Odramech para sondar serviços internos). Em desenvolvimento, localhost é permitido (MailHog etc.).
   */
  private async assertSafeHost(host: string) {
    if (!this.config.values.isProduction) return;
    let address = host;
    if (!isIP(host)) {
      try { address = (await lookup(host)).address; } catch { throw new BadRequestException('Servidor SMTP não encontrado (DNS).'); }
    }
    if (isPrivate(address)) throw new BadRequestException('Servidor SMTP não permitido (endereço interno).');
  }
}

function isPrivate(ip: string): boolean {
  if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) return true;
  const v4 = ip.replace(/^::ffff:/, '');
  const [a, b] = v4.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** mensagens de erro do SMTP em português */
function friendly(code: string | undefined, message: string): string {
  switch (code) {
    case 'EAUTH': return 'Usuário ou senha do SMTP recusados. No Gmail/Outlook use uma "senha de app".';
    case 'ECONNECTION': case 'ECONNREFUSED': return 'Não foi possível conectar ao servidor SMTP. Confira servidor e porta.';
    case 'ETIMEDOUT': case 'ESOCKET': return 'O servidor SMTP não respondeu. Confira servidor, porta e a opção SSL/TLS (465 = SSL, 587 = STARTTLS).';
    case 'EDNS': return 'Servidor SMTP não encontrado (DNS).';
    case 'EENVELOPE': return 'O servidor recusou o remetente ou o destinatário. O e-mail do remetente precisa ser do domínio/conta configurada.';
    default: return `Falha no SMTP: ${message}`;
  }
}
