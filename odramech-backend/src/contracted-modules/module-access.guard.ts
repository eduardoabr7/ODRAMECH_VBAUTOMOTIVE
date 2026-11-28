import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { ContractedModule } from './contracted-module';
import { REQUIRES_MODULE } from './requires-module.decorator';
import { ModuleAccessService, moduleRequired } from './module-access.service';

/**
 * Guard global: rotas marcadas com @RequiresModule(...) exigem o contrato do módulo ativo.
 * Roda depois do JwtAuthGuard e do SubscriptionAccessGuard (ordem no AppModule), então a
 * assinatura bloqueada continua deixando o módulo em somente leitura.
 *
 * A decisão vem do serviço de assinaturas, servidor → servidor: esconder/mostrar o menu no
 * navegador é só conveniência; quem garante é este guard.
 */
@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly access: ModuleAccessService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const module = this.reflector.getAllAndOverride<ContractedModule | undefined>(REQUIRES_MODULE, [ctx.getHandler(), ctx.getClass()]);
    if (!module) return true;

    const auth = ctx.switchToHttp().getRequest().authContext as AuthPayload | undefined;
    // rota de módulo nunca é pública: sem sessão completa (empresa escolhida) não entra
    if (!auth?.enterpriseId || auth.context !== 'AUTH') throw moduleRequired(module);
    if (!(await this.access.isActive(auth.enterpriseId, module))) throw moduleRequired(module);
    return true;
  }
}
