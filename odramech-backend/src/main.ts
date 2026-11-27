import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import { AppConfig } from './core/config/app-config';
import { createValidationPipe } from './core/http/validation-pipe.factory';
import { AppModule } from './app.module';
import { CustomLogger } from './shared/services/custom-logger.service';

async function bootstrap() {
  // carrega e valida o .env antes de qualquer módulo (falha rápido com mensagem clara)
  const config = AppConfig.get().values;
  const logger = new CustomLogger();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // logo e imagem da tela de login chegam como data URL (até ~3 MB)
  app.useBodyParser('json', { limit: '6mb' });

  app.enableCors({
    origin: config.frontendOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();

  await app.listen(config.port);
  logger.log(`🚀🚀🚀 Backend-Nest rodando na porta ${config.port} 🚀🚀🚀`, '#00b8b9');
}
bootstrap();
