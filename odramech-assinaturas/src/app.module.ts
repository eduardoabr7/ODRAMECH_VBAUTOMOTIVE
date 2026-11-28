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
  EnterpriseSubscriptionController, GatewayController, HealthController, PlansController, SUBSCRIPTION_SERVICE,
} from './http/controllers';
import { AdminAuthService } from './admin/admin-auth.service';
import { ADMIN_LICENSE_SERVICE, AdminAuthController, AdminLicensesController } from './admin/admin.controllers';
import { AdminLicenseService } from './application/admin-license.service';
import { EnterpriseDirectory, HttpEnterpriseDirectory } from './application/enterprise-directory';
import { HttpModuleContractNotifier, ModuleContractService } from './application/module-contract.service';
import {
  ModuleContractEventLog, ModuleContractRepository, PrismaModuleContractEventLog, PrismaModuleContractRepository,
} from './repositories/module-contract.repositories';
import { AdminModuleContractsController, EnterpriseModulesController, MODULE_CONTRACT_SERVICE } from './http/module-contracts.controller';

/** Escolhe a família de provedor de pagamento pela configuração (Abstract Factory). */
function providerFactory(): PaymentProviderFactory {
  switch (SubscriptionsConfig.get().values.paymentProvider) {
    case 'sandbox':
    default:
      return new SandboxProviderFactory(SubscriptionsConfig.get().values.sandboxWebhookSecret);
  }
}

/**
 * Composição do serviço: aqui as abstrações recebem suas implementações concretas.
 * Nada fora deste arquivo sabe que o banco é Prisma ou que o gateway é o sandbox.
 */
@Module({
  controllers: [HealthController, PlansController, EnterpriseSubscriptionController, GatewayController, AdminAuthController, AdminLicensesController,
    EnterpriseModulesController, AdminModuleContractsController,
  ],
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
          {
            trialDays: cfg.trialDays, graceDays: cfg.graceDays, renewalLeadDays: cfg.renewalLeadDays,
            defaultPlanCode: cfg.defaultPlanCode, paymentsEnabled: cfg.paymentsEnabled,
          },
        );
      },
    },
    AdminAuthService,
    {
      provide: EnterpriseDirectory,
      useFactory: () => {
        const cfg = SubscriptionsConfig.get().values;
        return new HttpEnterpriseDirectory(cfg.mainBackendUrl, cfg.apiKey);
      },
    },
    {
      provide: ADMIN_LICENSE_SERVICE,
      inject: [PlanRepository, SubscriptionRepository, InvoiceRepository, EventLogRepository, SubscriptionEventPublisher, SUBSCRIPTION_SERVICE, EnterpriseDirectory, Clock],
      useFactory: (plans, subs, invoices, log, events, billing, directory, clock) => {
        const cfg = SubscriptionsConfig.get().values;
        return new AdminLicenseService(plans, subs, invoices, log, events, billing, directory, clock, {
          trialDays: cfg.trialDays, graceDays: cfg.graceDays, defaultPlanCode: cfg.defaultPlanCode,
        });
      },
    },
    // contratos de módulos adicionais (estoque): agregado próprio, separado da assinatura
    { provide: ModuleContractRepository, useClass: PrismaModuleContractRepository },
    { provide: ModuleContractEventLog, useClass: PrismaModuleContractEventLog },
    {
      provide: MODULE_CONTRACT_SERVICE,
      inject: [ModuleContractRepository, ModuleContractEventLog, Clock],
      useFactory: (repo: ModuleContractRepository, log: ModuleContractEventLog, clock: Clock) => {
        const cfg = SubscriptionsConfig.get().values;
        return new ModuleContractService(repo, log, new HttpModuleContractNotifier(cfg.mainBackendUrl, cfg.apiKey), clock);
      },
    },
    LifecycleScheduler,
  ],
})
export class AppModule {}
