/**
 * Módulos vendidos À PARTE da assinatura (contrato próprio, gerido no painel de licenças).
 * Para usar um módulo a empresa precisa de:
 *   1. contrato do módulo ativo     → ModuleAccessGuard (403 MODULE_REQUIRED)
 *   2. assinatura do Odramech ativa → SubscriptionAccessGuard (402; com @AllowWhenBlocked só leitura)
 */
export const ContractedModule = {
  INVENTORY: 'INVENTORY',
} as const;
export type ContractedModule = (typeof ContractedModule)[keyof typeof ContractedModule];

export const MODULE_LABEL: Record<ContractedModule, string> = {
  INVENTORY: 'Estoque de peças',
};

export interface ModuleAccess {
  module: ContractedModule;
  active: boolean;
  until: string | null;
  reason: string;
}

export interface ModuleAccessSet {
  modules: ModuleAccess[];
  /** true = serviço de assinaturas fora; valeu a última situação conhecida (ou "sem módulos") */
  degraded?: boolean;
}

export function isModuleActive(set: ModuleAccessSet, module: ContractedModule): boolean {
  return set.modules.some(m => m.module === module && m.active === true);
}
