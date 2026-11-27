import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppConfig } from 'src/core/config/app-config';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { SubscriptionGateway } from './gateway/subscription.gateway';
import { ALLOW_WHEN_BLOCKED } from './allow-when-blocked.decorator';

/** Rotas que sempre funcionam — para a empresa conseguir entrar, sair e regularizar a assinatura. */
const ALWAYS_ALLOWED = [/^\/auth\b/, /^\/subscription\b/, /^\/internal\b/, /^\/health\b/];

/**
 * Aplica a política de assinatura às requisições autenticadas.
 *
 *  SUBSCRIPTION_ENFORCEMENT=off   → não consulta nada
 *  SUBSCRIPTION_ENFORCEMENT=warn  → consulta e só informa (header X-Subscription-Access)
 *  SUBSCRIPTION_ENFORCEMENT=block → empresa bloqueada fica em modo SOMENTE LEITURA:
 *                                    só passam as rotas marcadas com @AllowWhenBlocked()
 *                                    (consultas). Todo o resto — escritas, exportação,
 *                                    PDF/impressão, download de anexos — recebe 402.
 *
 * A decisão vem sempre do serviço de assinaturas (servidor → servidor). Nada que o navegador
 * envie ou receba muda o resultado: editar a resposta HTTP só engana a própria tela.
 * Roda depois do JwtAuthGuard (ordem de registro no AppModule).
 */
@Injectable()
export class SubscriptionAccessGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionAccessGuard.name);

  constructor(
    private readonly gateway: SubscriptionGateway,
    private readonly config: AppConfig,
    private readonly reflector: Reflector,
  ) {}

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

    if (decision.level !== 'blocked') return true;
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_WHEN_BLOCKED, [ctx.getHandler(), ctx.getClass()])) return true;

    if (mode === 'warn') {
      this.logger.warn(`Empresa ${auth.enterpriseId} bloqueada (${decision.reason}) — ${req.method} ${path} permitido por SUBSCRIPTION_ENFORCEMENT=warn`);
      return true;
    }

    throw new HttpException(
      {
        statusCode: 402,
        code: 'SUBSCRIPTION_REQUIRED',
        reason: decision.reason,
        message: 'Assinatura inativa: o sistema está em modo somente leitura (sem cadastros, alterações, exportações ou impressões). Regularize em Configurações → Assinatura.',
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
