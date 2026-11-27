import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { AppConfig } from 'src/core/config/app-config';
import { PrismaService } from 'src/core/database/prisma.service';
import { assertManager } from 'src/shared/utils/role.util';
import { PaymentMethod, SubscriptionGateway } from './gateway/subscription.gateway';
import { PlanEntitlementsService } from './plan-entitlements.service';

/**
 * FACADE — tudo que a tela de assinatura precisa, numa interface simples.
 * Esconde: qual empresa é a da sessão, nome da empresa (vem do nosso banco),
 * quem pode alterar (só administradores) e o modo de cobrança configurado.
 */
@Injectable()
export class SubscriptionFacade {
  constructor(
    private readonly gateway: SubscriptionGateway,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  async overview(auth: AuthPayload) {
    const enterprise = await this.prisma.enterprise.findUnique({ where: { id: auth.enterpriseId }, select: { name: true } });
    const [data, establishmentCount] = await Promise.all([
      this.gateway.overview(auth.enterpriseId, enterprise?.name),
      this.entitlements.establishmentCount(auth.enterpriseId),
    ]);
    return {
      ...data,
      establishmentCount,
      enforcement: this.config.values.subscriptions.enforcement,
      /** o botão "Simular pagamento" só aparece fora de produção */
      canSimulate: !this.config.values.isProduction,
      canManage: auth.role === 'ADMIN' || auth.role === 'SUPERUSER',
    };
  }

  /** decisão de acesso leve — usada pelo banner do frontend */
  access(auth: AuthPayload) {
    return this.gateway.access(auth.enterpriseId);
  }

  async selectPlan(auth: AuthPayload, planCode: string, method: PaymentMethod) {
    assertManager(auth.role);
    // não deixa escolher um plano menor que a quantidade de estabelecimentos que a empresa já tem
    const plan = (await this.gateway.plans()).find(p => p.code === planCode);
    const count = await this.entitlements.establishmentCount(auth.enterpriseId);
    if (plan && plan.maxEstablishments != null && count > plan.maxEstablishments) {
      throw new ConflictException(
        `A empresa tem ${count} estabelecimentos e o plano ${plan.name} permite até ${plan.maxEstablishments}. Escolha um plano maior.`,
      );
    }
    const result = await this.gateway.selectPlan(auth.enterpriseId, planCode, method);
    return { ...result, establishmentCount: count };
  }

  pay(auth: AuthPayload, invoiceId: string, method: PaymentMethod, cardToken?: string) {
    assertManager(auth.role);
    return this.gateway.payInvoice(auth.enterpriseId, invoiceId, method, cardToken);
  }

  simulate(auth: AuthPayload, invoiceId: string) {
    assertManager(auth.role);
    // defesa extra: em produção nem repassa (o serviço de assinaturas também recusa)
    if (this.config.values.isProduction) throw new ForbiddenException('Simulação de pagamento desativada neste ambiente.');
    return this.gateway.simulatePayment(auth.enterpriseId, invoiceId);
  }

  cancel(auth: AuthPayload) {
    assertManager(auth.role);
    return this.gateway.cancel(auth.enterpriseId);
  }

  resume(auth: AuthPayload) {
    assertManager(auth.role);
    return this.gateway.resume(auth.enterpriseId);
  }

  /** webhook do serviço de assinaturas */
  onSubscriptionEvent(enterpriseId: number) {
    this.gateway.invalidate(enterpriseId);
  }
}
