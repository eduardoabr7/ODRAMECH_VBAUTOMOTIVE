import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { SubscriptionsConfig } from '../config/subscriptions-config';

export const PUBLIC_ROUTE = 'isPublicRoute';
export const PublicRoute = () => SetMetadata(PUBLIC_ROUTE, true);

/**
 * Autenticação serviço‑a‑serviço: o backend da oficina envia `x-api-key`.
 * Comparação em tempo constante para não vazar a chave por timing.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [ctx.getHandler(), ctx.getClass()])) return true;

    const provided = String(ctx.switchToHttp().getRequest().headers['x-api-key'] ?? '');
    const expected = SubscriptionsConfig.get().values.apiKey;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('API key inválida.');
    return true;
  }
}
