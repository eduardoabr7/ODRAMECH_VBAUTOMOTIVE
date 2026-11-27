import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SubscriptionsConfig } from './config/subscriptions-config';
import { AppModule } from './app.module';

async function bootstrap() {
  const config = SubscriptionsConfig.get().values;
  // serviço interno: só o backend da oficina conversa com ele (sem CORS para navegadores)
  // rawBody: o webhook do provedor confere a assinatura sobre os bytes exatos recebidos
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false, rawBody: true });
  // atrás do Nginx: o IP real vem do X-Forwarded-For (limite de tentativas do login do painel)
  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(config.port);
  new Logger('Bootstrap').log(`💳 Gerenciamento de Assinaturas Odramech na porta ${config.port} (provedor: ${config.paymentProvider}${config.paymentsEnabled ? '' : ' — PAGAMENTOS DESATIVADOS'})`);
}
bootstrap();
