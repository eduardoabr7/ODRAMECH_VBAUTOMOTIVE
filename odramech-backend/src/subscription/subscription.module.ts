import { Module } from '@nestjs/common';
import { AppConfig } from 'src/core/config/app-config';
import { SubscriptionGateway } from './gateway/subscription.gateway';
import { HttpSubscriptionGateway } from './gateway/http-subscription.gateway';
import { ResilientSubscriptionProxy } from './gateway/resilient-subscription.proxy';
import { CachingSubscriptionGateway } from './gateway/caching-subscription.gateway';
import { SubscriptionFacade } from './subscription.facade';
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
  controllers: [SubscriptionController, SubscriptionWebhookController],
  providers: [
    {
      provide: SubscriptionGateway,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        const s = config.values.subscriptions;
        const http = new HttpSubscriptionGateway(s.url, s.apiKey);
        const resilient = new ResilientSubscriptionProxy(http);
        return new CachingSubscriptionGateway(resilient, s.cacheTtlSeconds * 1000);
      },
    },
    SubscriptionFacade,
    SubscriptionAccessGuard,
  ],
  exports: [SubscriptionGateway, SubscriptionAccessGuard],
})
export class SubscriptionModule {}
