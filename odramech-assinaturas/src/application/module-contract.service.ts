import { BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import {
  CONTRACT_MODULES, ContractModule, decideModuleAccess, MODULE_LABEL, ModuleAccess, ModuleContract,
} from '../domain/module-contract';
import { ModuleContractEventLog, ModuleContractRepository } from '../repositories/module-contract.repositories';
import { Clock } from './clock';
import { AdminActor } from './admin-license.service';

/** Avisa o backend da oficina que o contrato mudou (ele limpa o cache na hora). */
export abstract class ModuleContractNotifier {
  abstract changed(enterpriseId: number, module: ContractModule, type: string): Promise<void>;
}

/** ADAPTER — POST {backend}/internal/module-contract-events com a x-api-key. Melhor esforço. */
export class HttpModuleContractNotifier extends ModuleContractNotifier {
  private readonly logger = new Logger('ModuleContractNotifier');
  constructor(private readonly baseUrl: string | null, private readonly apiKey: string) { super(); }

  async changed(enterpriseId: number, module: ContractModule, type: string) {
    if (!this.baseUrl) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    try {
      const res = await fetch(`${this.baseUrl}/internal/module-contract-events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
        body: JSON.stringify({ enterpriseId, module, type }),
        signal: ctrl.signal,
      });
      if (!res.ok) this.logger.warn(`Backend respondeu ${res.status} para ${type}`);
    } catch {
      this.logger.debug(`Backend indisponível para ${type} (ok, o cache dele expira sozinho)`);
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface ActivateInput {
  enterpriseName?: string | null;
  startsAt?: Date | null;
  /** null = sem prazo; undefined = mantém o atual */
  endsAt?: Date | null;
  priceCents?: number | null;
  note?: string | null;
}

const actorLabel = (a: AdminActor) => `admin:${a.id} ${a.email}`;

/**
 * Casos de uso dos contratos de módulo.
 *  - `access()` é a ÚNICA consulta exposta ao backend da oficina (x-api-key) e não vaza
 *    preço nem anotação interna;
 *  - o resto só é chamado pelas rotas do painel (sessão de administrador) e TODA alteração
 *    vai para a auditoria com o autor e avisa o backend.
 */
export class ModuleContractService {
  constructor(
    private readonly contracts: ModuleContractRepository,
    private readonly log: ModuleContractEventLog,
    private readonly notifier: ModuleContractNotifier,
    private readonly clock: Clock,
  ) {}

  // ═══ Oficina (serviço‑a‑serviço) ════════════════════════
  async access(enterpriseId: number): Promise<{ modules: ModuleAccess[] }> {
    const rows = await this.contracts.listByEnterprise(enterpriseId);
    const now = this.clock.now();
    return { modules: CONTRACT_MODULES.map(m => decideModuleAccess(rows.find(r => r.module === m) ?? null, m, now)) };
  }

  // ═══ Painel ═════════════════════════════════════════════
  catalog() {
    return CONTRACT_MODULES.map(code => ({ code, name: MODULE_LABEL[code] }));
  }

  /** contratos ativos por empresa — a lista de licenças mostra um selo por módulo */
  async summary() {
    const now = this.clock.now();
    const rows = await this.contracts.listAll();
    return rows.map(c => ({ enterpriseId: c.enterpriseId, module: c.module, status: c.status, endsAt: c.endsAt, active: decideModuleAccess(c, c.module, now).active }));
  }

  async listForEnterprise(enterpriseId: number) {
    const now = this.clock.now();
    const rows = await this.contracts.listByEnterprise(enterpriseId);
    return Promise.all(CONTRACT_MODULES.map(async module => {
      const contract = rows.find(r => r.module === module) ?? null;
      return {
        module,
        name: MODULE_LABEL[module],
        contract,
        access: decideModuleAccess(contract, module, now),
        events: contract ? await this.log.listByContract(contract.id, 50) : [],
      };
    }));
  }

  /** cria ou atualiza o contrato e deixa ATIVO (também reativa suspenso/encerrado) */
  async activate(actor: AdminActor, enterpriseId: number, module: ContractModule, input: ActivateInput) {
    const now = this.clock.now();
    const existing = await this.contracts.find(enterpriseId, module);
    const startsAt = input.startsAt ?? (existing && existing.status !== 'CANCELED' ? existing.startsAt : now);
    const endsAt = input.endsAt !== undefined ? input.endsAt : existing?.endsAt ?? null;
    if (endsAt && endsAt <= startsAt) throw new BadRequestException('O fim do contrato precisa ser depois do início.');
    if (endsAt && endsAt <= now) throw new BadRequestException('O fim do contrato precisa estar no futuro.');

    const data = {
      status: 'ACTIVE' as const,
      startsAt,
      endsAt,
      suspendedReason: null,
      ...(input.priceCents !== undefined && { priceCents: input.priceCents }),
      ...(input.note !== undefined && { adminNote: input.note }),
      ...(input.enterpriseName && { enterpriseName: input.enterpriseName }),
    };
    const contract = existing
      ? await this.contracts.update(existing.id, data)
      : await this.contracts.create({
          enterpriseId, module, enterpriseName: input.enterpriseName ?? null, priceCents: null, adminNote: null, ...data,
        });

    const type = !existing ? 'module.contracted' : existing.status === 'ACTIVE' ? 'module.updated' : 'module.reactivated';
    await this.record(actor, contract, type, {
      startsAt: contract.startsAt, endsAt: contract.endsAt, priceCents: contract.priceCents,
      ...(input.note !== undefined && { noteChanged: true }),
    });
    return this.view(contract);
  }

  async suspend(actor: AdminActor, enterpriseId: number, module: ContractModule, reason: string | null) {
    const c = await this.mustFind(enterpriseId, module);
    if (c.status === 'CANCELED') throw new ConflictException('Contrato encerrado — reative antes de suspender.');
    const updated = await this.contracts.update(c.id, { status: 'SUSPENDED', suspendedReason: reason });
    await this.record(actor, updated, 'module.suspended', { reason });
    return this.view(updated);
  }

  async unsuspend(actor: AdminActor, enterpriseId: number, module: ContractModule) {
    const c = await this.mustFind(enterpriseId, module);
    if (c.status !== 'SUSPENDED') throw new ConflictException('O contrato não está suspenso.');
    const updated = await this.contracts.update(c.id, { status: 'ACTIVE', suspendedReason: null });
    await this.record(actor, updated, 'module.unsuspended', {});
    return this.view(updated);
  }

  /** encerra o contrato: o módulo some na hora. Os dados de estoque da oficina NÃO são apagados. */
  async cancel(actor: AdminActor, enterpriseId: number, module: ContractModule) {
    const c = await this.mustFind(enterpriseId, module);
    if (c.status === 'CANCELED') throw new ConflictException('O contrato já está encerrado.');
    const updated = await this.contracts.update(c.id, { status: 'CANCELED', endsAt: c.endsAt && c.endsAt < this.clock.now() ? c.endsAt : this.clock.now() });
    await this.record(actor, updated, 'module.canceled', {});
    return this.view(updated);
  }

  // ═══ Internos ═══════════════════════════════════════════
  private view(c: ModuleContract) {
    return { contract: c, access: decideModuleAccess(c, c.module, this.clock.now()) };
  }

  private async mustFind(enterpriseId: number, module: ContractModule) {
    const c = await this.contracts.find(enterpriseId, module);
    if (!c) throw new NotFoundException(`A empresa não tem contrato de ${MODULE_LABEL[module].toLowerCase()}.`);
    return c;
  }

  private async record(actor: AdminActor, c: ModuleContract, type: string, data: Record<string, unknown>) {
    await this.log.append(c.id, type, { actor: actorLabel(actor), status: c.status, ...data });
    await this.notifier.changed(c.enterpriseId, c.module, type);
  }
}
