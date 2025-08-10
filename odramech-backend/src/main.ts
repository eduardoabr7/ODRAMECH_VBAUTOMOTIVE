import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as cookieParser from 'cookie-parser';
dotenv.config()

async function bootstrap() {

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

  Logger.log(`🚀🚀🚀 Backend-Nest rodando na porta ${port} 🚀🚀🚀`);
}
bootstrap();
