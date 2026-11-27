import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppConfig } from 'src/core/config/app-config';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { SubscriptionGateway } from './gateway/subscription.gateway';

/** Rotas que sempre funcionam — para a empresa conseguir regularizar a assinatura. */
const ALWAYS_ALLOWED = [/^\/auth\b/, /^\/subscription\b/, /^\/internal\b/, /^\/health\b/];
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Aplica a política de assinatura às requisições autenticadas.
 *
 *  SUBSCRIPTION_ENFORCEMENT=off   → não consulta nada
 *  SUBSCRIPTION_ENFORCEMENT=warn  → consulta e só informa (header X-Subscription-Access)
 *  SUBSCRIPTION_ENFORCEMENT=block → empresa bloqueada fica em modo SOMENTE LEITURA:
 *                                    GETs funcionam, escritas recebem 402.
 *
 * Roda depois do JwtAuthGuard (ordem de registro no AppModule).
 */
@Injectable()
export class SubscriptionAccessGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionAccessGuard.name);

  constructor(private readonly gateway: SubscriptionGateway, private readonly config: AppConfig) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const mode = this.config.values.subscriptions.enforcement;
    if (mode === 'off') return true;

    const req = ctx.switchToHttp().getRequest();
    const auth = req.authContext as AuthPayload | undefined;
    // rotas públicas / pré-login não têm empresa definida
    if (!auth?.enterpriseId || auth.context !== 'AUTH') return true;

    const path: string = (req.path ?? req.url ?? '').split('?')[0];
    if (ALWAYS_ALLOWED.some(r => r.test(path))) return true;

    const decision = await this.gateway.access(auth.enterpriseId);
    ctx.switchToHttp().getResponse().setHeader?.('X-Subscription-Access', decision.level);

    if (decision.level !== 'blocked' || READ_METHODS.has(req.method)) return true;

    if (mode === 'warn') {
      this.logger.warn(`Empresa ${auth.enterpriseId} bloqueada (${decision.reason}) — permitido por SUBSCRIPTION_ENFORCEMENT=warn`);
      return true;
    }

    throw new HttpException(
      { statusCode: 402, code: 'SUBSCRIPTION_REQUIRED', message: 'Assinatura inativa: o sistema está em modo somente leitura. Regularize em Configurações → Assinatura.' },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
