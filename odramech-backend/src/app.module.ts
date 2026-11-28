import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { SharedModule } from './shared/shared.module';
import { EnterpriseModule } from './enterprise/enterprise.module';
import { EstablishmentModule } from './establishment/establishment.module';
import { UserCorporationModule } from './user-corporations/user-corporations.module';
import { VehicleModule } from './vehicle/vehicle.module';
import { WorkOrderModule } from './work-order/work-order.module';
import { BillingModule } from './billing/billing.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { SubscriptionAccessGuard } from './subscription/subscription-access.guard';
import { SettingsModule } from './settings/settings.module';
import { ExportModule } from './export/export.module';
import { ContractedModulesModule } from './contracted-modules/contracted-modules.module';
import { InventoryModule } from './inventory/inventory.module';
import { ModuleAccessGuard } from './contracted-modules/module-access.guard';

@Module({
  imports: [
    CoreModule,
    UserModule,
    AuthModule,
    SharedModule,
    EnterpriseModule,
    EstablishmentModule,
    UserCorporationModule,
    VehicleModule,
    WorkOrderModule,
    BillingModule,
    DashboardModule,
    SubscriptionModule,
    SettingsModule,
    ExportModule,
    ContractedModulesModule,
    InventoryModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // ordem importa: autentica (JWT), aplica a política de assinatura e então a dos módulos contratados
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: SubscriptionAccessGuard },
    { provide: APP_GUARD, useExisting: ModuleAccessGuard },
  ],
})
export class AppModule {}
