import { Module } from '@nestjs/common';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { MailModule } from 'src/mail/mail.module';
import { MailSettingsService } from './services/mail-settings.service';
import { PublicBrandingController, SettingsController } from './controllers/settings.controller';
import { SettingsService } from './services/settings.service';

/** Configurações do estabelecimento (documento de orçamento) e tema da empresa. */
@Module({
  imports: [SubscriptionModule, MailModule],
  controllers: [SettingsController, PublicBrandingController],
  providers: [SettingsService, MailSettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
