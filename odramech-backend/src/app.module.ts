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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // ordem importa: autentica (JWT) e só então aplica a política de assinatura
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: SubscriptionAccessGuard },
  ],
})
export class AppModule {}
