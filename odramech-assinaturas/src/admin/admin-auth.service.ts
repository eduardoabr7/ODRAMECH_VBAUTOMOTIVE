import { HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { SubscriptionsConfig } from '../config/subscriptions-config';
import { PrismaService } from '../repositories/prisma.repositories';
import { DUMMY_HASH, newSessionToken, sessionId, verifyPassword, verifyTotp } from './crypto';

export const ADMIN_COOKIE = 'odm_admin';

export interface AdminPrincipal {
  id: number;
  email: string;
  name: string;
  totpEnabled: boolean;
}

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

/**
 * Login do painel administrativo.
 *  - senha com scrypt, comparação em tempo constante e mesmo custo quando o e-mail não existe;
 *  - 2º fator (TOTP) obrigatório para quem tem o segredo configurado;
 *  - 5 falhas por e-mail OU por IP → bloqueio de 15 minutos;
 *  - sessão = token aleatório no cookie httpOnly; no banco só o hash (logout revoga de verdade).
 */
@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger('AdminAuth');
  private readonly failures = new Map<string, { count: number; until: number }>();

  constructor(private readonly db: PrismaService) {}

  async login(email: string, password: string, totp: string | undefined, ip: string | null, userAgent: string | null) {
    const normalized = String(email ?? '').trim().toLowerCase();
    const keys = [`e:${normalized}`, `i:${ip ?? '?'}`];
    this.assertNotLocked(keys);

    const admin = await this.db.adminUser.findUnique({ where: { email: normalized } });
    const passwordOk = await verifyPassword(String(password ?? ''), admin?.passwordHash ?? DUMMY_HASH);
    if (!admin || !admin.active || !passwordOk) return this.fail(keys, normalized, 'credenciais');

    if (admin.totpSecret) {
      if (!totp) throw new UnauthorizedException({ statusCode: 401, code: 'TOTP_REQUIRED', message: 'Informe o código do autenticador.' });
      if (!verifyTotp(admin.totpSecret, totp)) return this.fail(keys, normalized, 'código 2FA');
    }

    keys.forEach(k => this.failures.delete(k));
    const token = newSessionToken();
    const hours = SubscriptionsConfig.get().values.adminSessionHours;
    const expiresAt = new Date(Date.now() + hours * 3_600_000);
    await this.db.$transaction([
      this.db.adminSession.deleteMany({ where: { adminId: admin.id, expiresAt: { lt: new Date() } } }),
      this.db.adminSession.create({ data: { id: sessionId(token), adminId: admin.id, expiresAt, ip, userAgent: userAgent?.slice(0, 300) ?? null } }),
      this.db.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } }),
    ]);
    this.logger.log(`Login do administrador ${admin.email} (${ip ?? 'ip?'})`);
    return { token, expiresAt, admin: { id: admin.id, email: admin.email, name: admin.name, totpEnabled: !!admin.totpSecret } };
  }

  /** valida o cookie; null = sem sessão válida */
  async authenticate(token: string | undefined): Promise<AdminPrincipal | null> {
    if (!token || token.length < 20 || token.length > 100) return null;
    const session = await this.db.adminSession.findUnique({ where: { id: sessionId(token) }, include: { admin: true } });
    if (!session || session.expiresAt <= new Date() || !session.admin.active) return null;
    const { admin } = session;
    return { id: admin.id, email: admin.email, name: admin.name, totpEnabled: !!admin.totpSecret };
  }

  async logout(token: string | undefined) {
    if (token) await this.db.adminSession.deleteMany({ where: { id: sessionId(token) } });
  }

  private assertNotLocked(keys: string[]) {
    const now = Date.now();
    for (const k of keys) {
      const f = this.failures.get(k);
      if (f && f.until > now) {
        throw new HttpException(
          { statusCode: 429, message: `Muitas tentativas. Tente de novo em ${Math.ceil((f.until - now) / 60000)} minuto(s).` },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  private fail(keys: string[], email: string, what: string): never {
    const now = Date.now();
    for (const k of keys) {
      const prev = this.failures.get(k);
      const count = (prev && prev.until <= now && prev.count >= MAX_FAILURES ? 0 : prev?.count ?? 0) + 1;
      this.failures.set(k, { count, until: count >= MAX_FAILURES ? now + LOCK_MS : 0 });
    }
    this.logger.warn(`Falha de login no painel (${what}) para ${email || '(vazio)'}`);
    throw new UnauthorizedException('E-mail, senha ou código inválidos.');
  }
}
