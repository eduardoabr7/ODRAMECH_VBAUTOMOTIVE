import { Module } from '@nestjs/common';
import { AppConfig } from 'src/core/config/app-config';
import { PrismaService } from 'src/core/database/prisma.service';
import { ModuleContractsGateway } from './gateway/module-contracts.gateway';
import { HttpModuleContractsGateway } from './gateway/http-module-contracts.gateway';
import { ResilientModuleContractsGateway } from './gateway/resilient-module-contracts.gateway';
import { ModuleAccessService } from './module-access.service';
import { ModuleAccessGuard } from './module-access.guard';
import { ContractedModulesController, ModuleContractWebhookController } from './contracted-modules.controller';

/**
 * Contratos de módulos adicionais. Cadeia: ResilientModuleContractsGateway (cache + última
 * situação conhecida + circuit breaker) → HttpModuleContractsGateway (REST + x-api-key).
 */
@Module({
  controllers: [ContractedModulesController, ModuleContractWebhookController],
  providers: [
    {
      provide: ModuleContractsGateway,
      inject: [AppConfig, PrismaService],
      useFactory: (config: AppConfig, prisma: PrismaService) => {
        const s = config.values.subscriptions;
        return new ResilientModuleContractsGateway(new HttpModuleContractsGateway(s.url, s.apiKey), prisma, s.cacheTtlSeconds * 1000);
      },
    },
    ModuleAccessService,
    ModuleAccessGuard,
  ],
  exports: [ModuleAccessService, ModuleAccessGuard],
})
export class ContractedModulesModule {}
