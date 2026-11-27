import { Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { AccessDecision } from './subscription.gateway';

/**
 * Guarda a última decisão de acesso de cada empresa (memória + banco).
 *
 * Usada pelo circuit breaker quando o serviço de assinaturas não responde:
 * em vez de liberar tudo para todo mundo ("falha aberta"), cada empresa continua com
 * a última situação conhecida — quem estava bloqueado continua bloqueado.
 * Persistir no banco faz isso valer também depois de reiniciar o backend.
 */
export class LastKnownAccessStore {
  private readonly logger = new Logger('LastKnownAccess');
  private readonly memory = new Map<number, AccessDecision>();

  constructor(private readonly prisma: PrismaService | null) {}

  /** grava só quando muda (o guard chama isso a cada decisão nova vinda do serviço) */
  remember(enterpriseId: number, decision: AccessDecision): void {
    const clean: AccessDecision = { status: decision.status, level: decision.level, until: decision.until, reason: decision.reason, plan: decision.plan ?? null };
    const previous = this.memory.get(enterpriseId);
    this.memory.set(enterpriseId, clean);
    if (previous && JSON.stringify(previous) === JSON.stringify(clean)) return;
    if (!this.prisma) return;
    const json = clean as unknown as object;
    this.prisma.subscriptionAccessSnapshot
      .upsert({ where: { enterpriseId }, create: { enterpriseId, decision: json }, update: { decision: json } })
      .catch(err => this.logger.warn(`Não salvou a última decisão da empresa ${enterpriseId}: ${(err as Error).message}`));
  }

  async recall(enterpriseId: number): Promise<AccessDecision | null> {
    const hit = this.memory.get(enterpriseId);
    if (hit) return hit;
    if (!this.prisma) return null;
    try {
      const row = await this.prisma.subscriptionAccessSnapshot.findUnique({ where: { enterpriseId } });
      if (!row) return null;
      const decision = row.decision as unknown as AccessDecision;
      this.memory.set(enterpriseId, decision);
      return decision;
    } catch {
      return null;
    }
  }
}
