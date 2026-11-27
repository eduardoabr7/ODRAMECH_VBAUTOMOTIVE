import { Module } from '@nestjs/common';
import { AppConfig } from 'src/core/config/app-config';
import { SubscriptionGateway } from './gateway/subscription.gateway';
import { HttpSubscriptionGateway } from './gateway/http-subscription.gateway';
import { ResilientSubscriptionProxy } from './gateway/resilient-subscription.proxy';
import { CachingSubscriptionGateway } from './gateway/caching-subscription.gateway';
import { LastKnownAccessStore } from './gateway/last-known-access.store';
import { PrismaService } from 'src/core/database/prisma.service';
import { InternalEnterprisesController } from './internal-enterprises.controller';
import { SubscriptionFacade } from './subscription.facade';
import { PlanEntitlementsService } from './plan-entitlements.service';
import { SubscriptionAccessGuard } from './subscription-access.guard';
import { SubscriptionController, SubscriptionWebhookController } from './subscription.controller';

/**
 * Montagem da cadeia (de fora para dentro):
 *   CachingSubscriptionGateway   — DECORATOR: cache da decisão de acesso
 *     → ResilientSubscriptionProxy — PROXY: circuit breaker / falha aberta
 *       → HttpSubscriptionGateway  — ADAPTER: REST do serviço de assinaturas
 * Todos implementam SubscriptionGateway; quem consome não sabe que é uma cadeia.
 */
@Module({
  controllers: [SubscriptionController, SubscriptionWebhookController, InternalEnterprisesController],
  providers: [
    {
      provide: SubscriptionGateway,
      inject: [AppConfig, PrismaService],
      useFactory: (config: AppConfig, prisma: PrismaService) => {
        const s = config.values.subscriptions;
        const http = new HttpSubscriptionGateway(s.url, s.apiKey);
        const resilient = new ResilientSubscriptionProxy(http, 3, 30_000, new LastKnownAccessStore(prisma));
        return new CachingSubscriptionGateway(resilient, s.cacheTtlSeconds * 1000);
      },
    },
    SubscriptionFacade,
    SubscriptionAccessGuard,
    PlanEntitlementsService,
  ],
  exports: [SubscriptionGateway, SubscriptionAccessGuard, PlanEntitlementsService],
})
export class SubscriptionModule {}
