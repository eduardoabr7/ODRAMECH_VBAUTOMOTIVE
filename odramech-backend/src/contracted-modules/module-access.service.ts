import { ForbiddenException, Injectable } from '@nestjs/common';
import { ContractedModule, isModuleActive, MODULE_LABEL, ModuleAccessSet } from './contracted-module';
import { ModuleContractsGateway } from './gateway/module-contracts.gateway';

/** Consulta de "a empresa contratou o módulo?" para guards e serviços. */
@Injectable()
export class ModuleAccessService {
  constructor(private readonly gateway: ModuleContractsGateway) {}

  of(enterpriseId: number): Promise<ModuleAccessSet> {
    return this.gateway.access(enterpriseId);
  }

  async isActive(enterpriseId: number, module: ContractedModule): Promise<boolean> {
    if (!enterpriseId) return false;
    return isModuleActive(await this.gateway.access(enterpriseId), module);
  }

  async assertActive(enterpriseId: number, module: ContractedModule): Promise<void> {
    if (await this.isActive(enterpriseId, module)) return;
    throw moduleRequired(module);
  }

  invalidate(enterpriseId: number): void {
    this.gateway.invalidate(enterpriseId);
  }
}

export function moduleRequired(module: ContractedModule) {
  return new ForbiddenException({
    statusCode: 403,
    code: 'MODULE_REQUIRED',
    module,
    message: `O módulo ${MODULE_LABEL[module]} não está contratado para esta empresa. Fale com o suporte Odramech para contratar.`,
  });
}
