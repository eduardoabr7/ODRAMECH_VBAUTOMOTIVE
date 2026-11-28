import { Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { ModuleAccessSet } from '../contracted-module';
import { ModuleContractsGateway } from './module-contracts.gateway';
import { ModuleContractsUnavailable } from './http-module-contracts.gateway';

interface Entry {
  value: ModuleAccessSet;
  expiresAt: number;
}

/** só o que importa guardar (memória e banco) */
const snapshotOf = (v: ModuleAccessSet): ModuleAccessSet => ({ modules: v.modules });

/**
 * DECORATOR (cache) + PROXY (resiliência) sobre o gateway HTTP — mesma interface.
 *
 *  - Cache curto por empresa: o guard consulta a cada requisição do módulo.
 *  - Serviço fora do ar: vale a última situação conhecida (memória → banco). Quem tinha o
 *    módulo continua trabalhando; quem NUNCA foi visto fica SEM o módulo (falha fechada:
 *    é um adicional pago — diferente da assinatura, cuja queda nunca para a oficina).
 *  - Circuit breaker simples: depois de N falhas seguidas, para de chamar por um tempo.
 */
export class ResilientModuleContractsGateway extends ModuleContractsGateway {
  private readonly logger = new Logger('ModuleContracts');
  private readonly cache = new Map<number, Entry>();
  private readonly lastKnown = new Map<number, ModuleAccessSet>();
  private failures = 0;
  private openUntil = 0;

  constructor(
    private readonly inner: ModuleContractsGateway,
    private readonly prisma: PrismaService | null,
    private readonly ttlMs: number,
    private readonly failureThreshold = 3,
    private readonly cooldownMs = 30_000,
  ) {
    super();
  }

  async access(enterpriseId: number): Promise<ModuleAccessSet> {
    const hit = this.cache.get(enterpriseId);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    try {
      if (Date.now() < this.openUntil) throw new ModuleContractsUnavailable('circuito aberto');
      const value = snapshotOf(await this.inner.access(enterpriseId));
      this.failures = 0;
      if (this.ttlMs > 0) this.cache.set(enterpriseId, { value, expiresAt: Date.now() + this.ttlMs });
      this.remember(enterpriseId, value);
      return value;
    } catch (err) {
      if (!(err instanceof ModuleContractsUnavailable)) throw err;
      if (++this.failures >= this.failureThreshold && Date.now() >= this.openUntil) {
        this.openUntil = Date.now() + this.cooldownMs;
        this.logger.warn(`Serviço de assinaturas indisponível — consulta de módulos pausada por ${this.cooldownMs / 1000}s.`);
      }
      const known = await this.recall(enterpriseId);
      return { modules: known?.modules ?? [], degraded: true };
    }
  }

  invalidate(enterpriseId: number): void {
    this.cache.delete(enterpriseId);
    this.inner.invalidate(enterpriseId);
  }

  private remember(enterpriseId: number, value: ModuleAccessSet) {
    const previous = this.lastKnown.get(enterpriseId);
    this.lastKnown.set(enterpriseId, value);
    if (!this.prisma || (previous && JSON.stringify(previous) === JSON.stringify(value))) return;
    const modules = value.modules as unknown as object;
    this.prisma.moduleAccessSnapshot
      .upsert({ where: { enterpriseId }, create: { enterpriseId, modules }, update: { modules } })
      .catch(e => this.logger.warn(`Não salvou a situação dos módulos da empresa ${enterpriseId}: ${(e as Error).message}`));
  }

  private async recall(enterpriseId: number): Promise<ModuleAccessSet | null> {
    const mem = this.lastKnown.get(enterpriseId);
    if (mem) return mem;
    if (!this.prisma) return null;
    try {
      const row = await this.prisma.moduleAccessSnapshot.findUnique({ where: { enterpriseId } });
      if (!row || !Array.isArray(row.modules)) return null;
      const set: ModuleAccessSet = { modules: row.modules as unknown as ModuleAccessSet['modules'] };
      this.lastKnown.set(enterpriseId, set);
      return set;
    } catch {
      return null;
    }
  }
}
