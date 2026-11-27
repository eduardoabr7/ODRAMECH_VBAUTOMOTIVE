import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { SubscriptionsConfig } from '../config/subscriptions-config';
import { ADMIN_COOKIE, AdminAuthService } from '../admin/admin-auth.service';

export const PUBLIC_ROUTE = 'isPublicRoute';
export const PublicRoute = () => SetMetadata(PUBLIC_ROUTE, true);

/** rotas do painel administrativo: exigem sessão de administrador (cookie), nunca a API key */
export const ADMIN_ROUTE = 'isAdminRoute';
export const AdminRoute = () => SetMetadata(ADMIN_ROUTE, true);

/** header obrigatório nas escritas do painel — um site de terceiros não consegue enviá-lo (anti-CSRF) */
export const ADMIN_CSRF_HEADER = 'x-odramech-admin';

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

/**
 * Guard único do serviço — cada rota cai em exatamente um destes grupos:
 *   @PublicRoute()  → sem autenticação (health, lista de planos, webhook do provedor, login do painel)
 *   @AdminRoute()   → sessão de administrador válida + header anti-CSRF nas escritas
 *   (padrão)        → serviço‑a‑serviço: x-api-key do backend da oficina, comparada em tempo constante
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly adminAuth: AdminAuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const req = ctx.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, targets);
    const isAdmin = this.reflector.getAllAndOverride<boolean>(ADMIN_ROUTE, targets);

    if (isAdmin) {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers[ADMIN_CSRF_HEADER] !== '1') {
        throw new ForbiddenException('Requisição recusada.');
      }
      if (isPublic) return true; // login
      const principal = await this.adminAuth.authenticate(readCookie(req.headers.cookie, ADMIN_COOKIE));
      if (!principal) throw new UnauthorizedException('Sessão do painel expirada. Entre de novo.');
      req.admin = principal;
      return true;
    }
    if (isPublic) return true;

    const provided = String(req.headers['x-api-key'] ?? '');
    const expected = SubscriptionsConfig.get().values.apiKey;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('API key inválida.');
    return true;
  }
}
