import { ModuleAccessSet } from '../contracted-module';

/** Porta: quais módulos adicionais a empresa contratou (vem do serviço de assinaturas). */
export abstract class ModuleContractsGateway {
  abstract access(enterpriseId: number): Promise<ModuleAccessSet>;
  /** aviso do serviço (webhook) → descartar cache */
  abstract invalidate(enterpriseId: number): void;
}
