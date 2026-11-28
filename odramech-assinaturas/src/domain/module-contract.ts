/**
 * Contratos de MÓDULOS ADICIONAIS (ex.: Estoque de peças).
 *
 * São um contrato à parte da assinatura: preço, prazo e estado próprios, geridos só pelo
 * painel administrativo. Esta camada decide apenas "o contrato está valendo?" — a regra
 * "também precisa de assinatura ativa" é aplicada no backend da oficina, que já cruza as duas.
 */

export const CONTRACT_MODULES = ['INVENTORY'] as const;
export type ContractModule = (typeof CONTRACT_MODULES)[number];

export const MODULE_LABEL: Record<ContractModule, string> = {
  INVENTORY: 'Estoque de peças',
};

export const isContractModule = (v: string): v is ContractModule => (CONTRACT_MODULES as readonly string[]).includes(v);

export type ModuleContractStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELED';

export interface ModuleContract {
  id: string;
  enterpriseId: number;
  enterpriseName: string | null;
  module: ContractModule;
  status: ModuleContractStatus;
  startsAt: Date;
  /** null = sem prazo */
  endsAt: Date | null;
  priceCents: number | null;
  suspendedReason: string | null;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewModuleContract = Omit<ModuleContract, 'id' | 'createdAt' | 'updatedAt'>;

/** O que a oficina recebe: só o necessário para decidir acesso (nada de nota interna ou preço). */
export interface ModuleAccess {
  module: ContractModule;
  active: boolean;
  /** fim do contrato (ISO) — null = sem prazo ou sem contrato */
  until: string | null;
  reason: string;
}

/**
 * Política de acesso do contrato. Olha as DATAS, não só o status: contrato vencido para
 * na hora, sem esperar agendador nem tolerância (é um adicional contratado com prazo).
 */
export function decideModuleAccess(contract: ModuleContract | null, module: ContractModule, now: Date): ModuleAccess {
  const label = MODULE_LABEL[module];
  if (!contract) return { module, active: false, until: null, reason: `${label} não contratado.` };

  const until = contract.endsAt?.toISOString() ?? null;
  if (contract.status === 'CANCELED') return { module, active: false, until, reason: `Contrato de ${label.toLowerCase()} encerrado.` };
  if (contract.status === 'SUSPENDED') return { module, active: false, until, reason: `Contrato de ${label.toLowerCase()} suspenso.` };
  if (contract.startsAt > now) return { module, active: false, until, reason: `Contrato de ${label.toLowerCase()} começa em ${contract.startsAt.toISOString().slice(0, 10)}.` };
  if (contract.endsAt && contract.endsAt <= now) return { module, active: false, until, reason: `Contrato de ${label.toLowerCase()} vencido.` };
  return { module, active: true, until, reason: 'Contrato ativo.' };
}
