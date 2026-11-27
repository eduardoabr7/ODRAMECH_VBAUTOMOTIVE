import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Envio de e-mail (SMTP da empresa ou o padrão do Odramech). */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
