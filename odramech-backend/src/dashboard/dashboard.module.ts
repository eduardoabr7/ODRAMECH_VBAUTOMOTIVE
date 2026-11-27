import { Controller, Get, Module } from '@nestjs/common';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { CurrentAuth } from 'src/core/auth/current-auth.decorator';
import { WorkOrderModule } from 'src/work-order/work-order.module';
import { BillingModule } from 'src/billing/billing.module';
import { DashboardFacade } from './dashboard.facade';
import { AllowWhenBlocked } from 'src/subscription/allow-when-blocked.decorator';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardFacade) {}

  @AllowWhenBlocked()
  @Get()
  overview(@CurrentAuth() auth: AuthPayload) {
    return this.dashboard.overview(auth);
  }
}

@Module({
  imports: [WorkOrderModule, BillingModule],
  controllers: [DashboardController],
  providers: [DashboardFacade],
})
export class DashboardModule {}
