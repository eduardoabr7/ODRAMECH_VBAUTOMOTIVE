import { SetMetadata } from '@nestjs/common';
import { ContractedModule } from './contracted-module';

export const REQUIRES_MODULE = 'requiresModule';

/**
 * A rota (ou o controller inteiro) só funciona para empresas com o módulo contratado.
 * Aplicado pelo ModuleAccessGuard global — vale para leitura E escrita.
 */
export const RequiresModule = (module: ContractedModule) => SetMetadata(REQUIRES_MODULE, module);
