import { Logger } from '@nestjs/common';
import { ContractedModule, ModuleAccess, ModuleAccessSet } from '../contracted-module';
import { ModuleContractsGateway } from './module-contracts.gateway';

export class ModuleContractsUnavailable extends Error {}

const KNOWN = new Set<string>(Object.values(ContractedModule));

/**
 * ADAPTER — GET {assinaturas}/enterprises/:id/modules com x-api-key.
 * A resposta é revalidada aqui (nada de confiar cegamente no formato): só módulos conhecidos
 * e `active` estritamente booleano entram.
 */
export class HttpModuleContractsGateway extends ModuleContractsGateway {
  private readonly logger = new Logger('ModuleContractsHttp');

  constructor(private readonly baseUrl: string, private readonly apiKey: string, private readonly timeoutMs = 4000) {
    super();
  }

  async access(enterpriseId: number): Promise<ModuleAccessSet> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/enterprises/${enterpriseId}/modules`, {
        headers: { 'x-api-key': this.apiKey },
        signal: ctrl.signal,
      });
    } catch (err) {
      throw new ModuleContractsUnavailable((err as Error).message);
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      this.logger.warn(`Serviço de assinaturas respondeu ${res.status} ao consultar módulos da empresa ${enterpriseId}`);
      throw new ModuleContractsUnavailable(`HTTP ${res.status}`);
    }
    const body = (await res.json().catch(() => null)) as { modules?: unknown } | null;
    return { modules: Array.isArray(body?.modules) ? body.modules.filter(isAccessLike).map(clean) : [] };
  }

  invalidate(): void { /* sem estado */ }
}

function isAccessLike(m: unknown): m is Record<string, unknown> {
  return !!m && typeof m === 'object' && KNOWN.has(String((m as Record<string, unknown>).module));
}

function clean(m: Record<string, unknown>): ModuleAccess {
  return {
    module: m.module as ContractedModule,
    active: m.active === true,
    until: typeof m.until === 'string' ? m.until : null,
    reason: typeof m.reason === 'string' ? m.reason.slice(0, 200) : '',
  };
}
