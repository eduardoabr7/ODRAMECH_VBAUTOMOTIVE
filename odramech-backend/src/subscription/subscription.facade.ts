import { Injectable } from '@nestjs/common';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { AppConfig } from 'src/core/config/app-config';
import { PrismaService } from 'src/core/database/prisma.service';
import { assertManager } from 'src/shared/utils/role.util';
import { PaymentMethod, SubscriptionGateway } from './gateway/subscription.gateway';

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
  ) {}

  async overview(auth: AuthPayload) {
    const enterprise = await this.prisma.enterprise.findUnique({ where: { id: auth.enterpriseId }, select: { name: true } });
    const data = await this.gateway.overview(auth.enterpriseId, enterprise?.name);
    return {
      ...data,
      enforcement: this.config.values.subscriptions.enforcement,
      canManage: auth.role === 'ADMIN' || auth.role === 'SUPERUSER',
    };
  }

  /** decisão de acesso leve — usada pelo banner do frontend */
  access(auth: AuthPayload) {
    return this.gateway.access(auth.enterpriseId);
  }

  selectPlan(auth: AuthPayload, planCode: string, method: PaymentMethod) {
    assertManager(auth.role);
    return this.gateway.selectPlan(auth.enterpriseId, planCode, method);
  }

  pay(auth: AuthPayload, invoiceId: string, method: PaymentMethod, cardToken?: string) {
    assertManager(auth.role);
    return this.gateway.payInvoice(auth.enterpriseId, invoiceId, method, cardToken);
  }

  simulate(auth: AuthPayload, invoiceId: string) {
    assertManager(auth.role);
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
