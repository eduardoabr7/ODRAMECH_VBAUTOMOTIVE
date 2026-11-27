import { Global, Module } from '@nestjs/common';
import { AppConfig } from './config/app-config';
import { PrismaService } from './database/prisma.service';
import { DomainEventBus } from './events/domain-event-bus';
import { CommandBus } from './commands/command-bus';
import { CustomLogger } from 'src/shared/services/custom-logger.service';
import { EstablishmentScope } from './auth/establishment-scope.service';

/**
 * Infraestrutura compartilhada, registrada UMA vez (@Global).
 * Os demais módulos só injetam — ninguém mais declara PrismaService em `providers`.
 */
@Global()
@Module({
  providers: [
    { provide: AppConfig, useFactory: () => AppConfig.get() },
    PrismaService,
    DomainEventBus,
    CommandBus,
    CustomLogger,
    EstablishmentScope,
  ],
  exports: [AppConfig, PrismaService, DomainEventBus, CommandBus, CustomLogger, EstablishmentScope],
})
export class CoreModule {}
