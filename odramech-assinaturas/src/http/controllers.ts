import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Inject, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { SubscriptionsConfig } from '../config/subscriptions-config';
import { SubscriptionService } from '../application/subscription.service';
import { PrismaService } from '../repositories/prisma.repositories';
import { PublicRoute } from './api-key.guard';
import { OverviewQueryDTO, PayInvoiceDTO, SelectPlanDTO } from './dto';

export const SUBSCRIPTION_SERVICE = Symbol('SubscriptionService');

@Controller()
export class HealthController {
  constructor(private readonly db: PrismaService) {}

  @PublicRoute()
  @Get('health')
  async health() {
    let database = true;
    try { await this.db.$queryRaw`SELECT 1`; } catch { database = false; }
    return { service: 'odramech-assinaturas', status: database ? 'ok' : 'degraded', database };
  }
}

@Controller('plans')
export class PlansController {
  constructor(@Inject(SUBSCRIPTION_SERVICE) private readonly service: SubscriptionService) {}

  @PublicRoute()
  @Get()
  list() { return this.service.listPlans(); }
}

/** Rotas por empresa (tenant). Só o backend da oficina chama, com API key. */
@Controller('enterprises/:enterpriseId/subscription')
export class EnterpriseSubscriptionController {
  constructor(@Inject(SUBSCRIPTION_SERVICE) private readonly service: SubscriptionService) {}

  @Get()
  overview(@Param('enterpriseId', ParseIntPipe) id: number, @Query() q: OverviewQueryDTO) {
    return this.service.overview(id, q.enterpriseName);
  }

  @Get('access')
  access(@Param('enterpriseId', ParseIntPipe) id: number) {
    return this.service.access(id);
  }

  @Post('plan')
  selectPlan(@Param('enterpriseId', ParseIntPipe) id: number, @Body() dto: SelectPlanDTO) {
    return this.service.selectPlan(id, dto.planCode, dto.method);
  }

  @Post('invoices/:invoiceId/pay')
  pay(@Param('enterpriseId', ParseIntPipe) id: number, @Param('invoiceId') invoiceId: string, @Body() dto: PayInvoiceDTO) {
    return this.service.payInvoice(id, invoiceId, dto.method, { cardToken: dto.cardToken });
  }

  // só no sandbox e fora de produção, senão vira plano pago de graça
  @Post('invoices/:invoiceId/simulate-payment')
  simulate(@Param('enterpriseId', ParseIntPipe) id: number, @Param('invoiceId') invoiceId: string) {
    if (!SubscriptionsConfig.get().values.allowSimulatedPayments) {
      throw new ForbiddenException('Simulação de pagamento desativada neste ambiente.');
    }
    return this.service.simulatePayment(id, invoiceId);
  }

  @Post('cancel')
  cancel(@Param('enterpriseId', ParseIntPipe) id: number) { return this.service.cancel(id); }

  @Post('resume')
  resume(@Param('enterpriseId', ParseIntPipe) id: number) { return this.service.resume(id); }
}

@Controller()
export class GatewayController {
  constructor(@Inject(SUBSCRIPTION_SERVICE) private readonly service: SubscriptionService) {}

  /** Webhook do provedor de pagamento (cada provedor valida a própria assinatura no parser). */
  @PublicRoute()
  @Post('webhooks/payments')
  @HttpCode(200)
  webhook(@Headers() headers: Record<string, unknown>, @Body() body: unknown) {
    return this.service.handleWebhook(headers, body);
  }
}

@Controller('admin')
export class AdminController {
  constructor(@Inject(SUBSCRIPTION_SERVICE) private readonly service: SubscriptionService) {}

  @Get('overview')
  overview() { return this.service.adminOverview(); }

  /** força uma rodada do agendador (útil para testar renovação/expiração) */
  @Post('run-lifecycle')
  run() { return this.service.processLifecycle(); }
}
