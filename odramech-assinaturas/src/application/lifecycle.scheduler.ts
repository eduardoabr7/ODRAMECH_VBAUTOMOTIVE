import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { SubscriptionsConfig } from '../config/subscriptions-config';
import { SUBSCRIPTION_SERVICE } from '../http/controllers';
import { SubscriptionService } from './subscription.service';

/** Roda o ciclo de cobrança periodicamente (renovações, inadimplência, expiração). */
@Injectable()
export class LifecycleScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(LifecycleScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(@Inject(SUBSCRIPTION_SERVICE) private readonly service: SubscriptionService) {}

  onApplicationBootstrap() {
    const seconds = SubscriptionsConfig.get().values.schedulerIntervalSeconds;
    this.timer = setInterval(() => this.tick(), seconds * 1000);
    this.logger.log(`Agendador de cobrança a cada ${seconds}s`);
    void this.tick();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return; // nunca sobrepõe rodadas
    this.running = true;
    try {
      await this.service.processLifecycle();
    } catch (err) {
      this.logger.error(`Rodada falhou: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
