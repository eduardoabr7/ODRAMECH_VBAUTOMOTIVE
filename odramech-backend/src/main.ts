import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CustomLogger } from './shared/custom-logger.service'
import * as dotenv from 'dotenv';
import * as cookieParser from 'cookie-parser';
dotenv.config()

async function bootstrap() {

  const logger = new CustomLogger();

  const frontendUrl = `http://${process.env.FRONTEND_HOST}:${process.env.FRONTEND_PORT}`;

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: frontendUrl,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.use(cookieParser());

  const port = process.env.PORT ?? 3000; 
  await app.listen(port);

  logger.log(`🚀🚀🚀 Backend-Nest rodando na porta ${port} 🚀🚀🚀`, '#00b8b9');
}
bootstrap();
