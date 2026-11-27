import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { PlanEntitlements, PlanFeature, SubscriptionGateway } from './gateway/subscription.gateway';

// Recursos e limite de estabelecimentos do plano, usando a decisão de acesso que o guard já
// cacheou. Se o serviço de assinaturas cair, libera tudo: cobrança fora do ar não trava a oficina.
@Injectable()
export class PlanEntitlementsService {
  constructor(private readonly gateway: SubscriptionGateway, private readonly prisma: PrismaService) {}

  /** null = plano desconhecido (serviço de assinaturas indisponível) */
  async of(enterpriseId: number): Promise<PlanEntitlements | null> {
    try {
      const decision = await this.gateway.access(enterpriseId);
      return decision.degraded ? null : decision.plan ?? null;
    } catch {
      return null;
    }
  }

  async has(enterpriseId: number, feature: PlanFeature): Promise<boolean> {
    const plan = await this.of(enterpriseId);
    return !plan || plan.features.includes(feature);
  }

  async assertFeature(enterpriseId: number, feature: PlanFeature, what: string): Promise<void> {
    if (await this.has(enterpriseId, feature)) return;
    throw new ForbiddenException({
      statusCode: 403,
      code: 'PLAN_UPGRADE_REQUIRED',
      message: `${what} está disponível a partir do plano Intermediário. Faça upgrade em Configurações → Assinatura.`,
    });
  }

  establishmentCount(enterpriseId: number): Promise<number> {
    return this.prisma.establishment.count({ where: { enterpriseId } });
  }

  /** chamado antes de criar um estabelecimento */
  async assertCanAddEstablishment(enterpriseId: number): Promise<void> {
    const plan = await this.of(enterpriseId);
    if (!plan || plan.maxEstablishments === null) return;
    const count = await this.establishmentCount(enterpriseId);
    if (count >= plan.maxEstablishments) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'PLAN_LIMIT_ESTABLISHMENTS',
        message: `O plano ${plan.name} permite até ${plan.maxEstablishments} estabelecimento(s). Faça upgrade em Configurações → Assinatura para cadastrar mais.`,
      });
    }
  }
}
