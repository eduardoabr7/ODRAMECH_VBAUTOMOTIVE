import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SubscriptionsConfig } from './config/subscriptions-config';
import { SubscriptionService } from './application/subscription.service';
import { LifecycleScheduler } from './application/lifecycle.scheduler';
import { Clock, SystemClock } from './application/clock';
import { PaymentProviderFactory } from './payments/payment-provider';
import { SandboxProviderFactory } from './payments/sandbox/sandbox.provider';
import { EventLogRepository, InvoiceRepository, PlanRepository, SubscriptionRepository } from './repositories/repositories';
import {
  PrismaEventLogRepository, PrismaInvoiceRepository, PrismaPlanRepository, PrismaService, PrismaSubscriptionRepository,
} from './repositories/prisma.repositories';
import { SubscriptionEventPublisher } from './events/subscription-events';
import { AuditTrailObserver, ConsoleObserver, MainBackendWebhookObserver } from './events/observers';
import { ApiKeyGuard } from './http/api-key.guard';
import {
  AdminController, EnterpriseSubscriptionController, GatewayController, HealthController, PlansController, SUBSCRIPTION_SERVICE,
} from './http/controllers';

/** Escolhe a família de provedor de pagamento pela configuração (Abstract Factory). */
function providerFactory(): PaymentProviderFactory {
  switch (SubscriptionsConfig.get().values.paymentProvider) {
    case 'sandbox':
    default:
      return new SandboxProviderFactory();
  }
}

/**
 * Composição do serviço: aqui as abstrações recebem suas implementações concretas.
 * Nada fora deste arquivo sabe que o banco é Prisma ou que o gateway é o sandbox.
 */
@Module({
  controllers: [HealthController, PlansController, EnterpriseSubscriptionController, GatewayController, AdminController],
  providers: [
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    PrismaService,
    { provide: PlanRepository, useClass: PrismaPlanRepository },
    { provide: SubscriptionRepository, useClass: PrismaSubscriptionRepository },
    { provide: InvoiceRepository, useClass: PrismaInvoiceRepository },
    { provide: EventLogRepository, useClass: PrismaEventLogRepository },
    { provide: Clock, useClass: SystemClock },
    { provide: PaymentProviderFactory, useFactory: providerFactory },
    {
      provide: SubscriptionEventPublisher,
      inject: [EventLogRepository],
      useFactory: (log: EventLogRepository) => {
        const cfg = SubscriptionsConfig.get().values;
        const publisher = new SubscriptionEventPublisher();
        publisher.attach(new AuditTrailObserver(log));
        publisher.attach(new ConsoleObserver());
        publisher.attach(new MainBackendWebhookObserver(cfg.mainBackendWebhookUrl, cfg.apiKey));
        return publisher;
      },
    },
    {
      provide: SUBSCRIPTION_SERVICE,
      inject: [PlanRepository, SubscriptionRepository, InvoiceRepository, PaymentProviderFactory, SubscriptionEventPublisher, Clock],
      useFactory: (plans, subs, invoices, provider: PaymentProviderFactory, events, clock) => {
        const cfg = SubscriptionsConfig.get().values;
        return new SubscriptionService(
          plans, subs, invoices,
          provider.createGateway(),
          provider.createWebhookParser(),
          events, clock,
          { trialDays: cfg.trialDays, graceDays: cfg.graceDays, renewalLeadDays: cfg.renewalLeadDays, defaultPlanCode: 'MENSAL' },
        );
      },
    },
    LifecycleScheduler,
  ],
})
export class AppModule {}
