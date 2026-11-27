import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SubscriptionsConfig } from './config/subscriptions-config';
import { AppModule } from './app.module';

async function bootstrap() {
  const config = SubscriptionsConfig.get().values;
  // serviço interno: só o backend da oficina conversa com ele (sem CORS para navegadores)
  const app = await NestFactory.create(AppModule, { cors: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(config.port);
  new Logger('Bootstrap').log(`💳 Gerenciamento de Assinaturas Odramech na porta ${config.port} (provedor: ${config.paymentProvider})`);
}
bootstrap();
