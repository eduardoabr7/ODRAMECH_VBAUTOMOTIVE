import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CustomLogger } from './shared/services/custom-logger.service'
import * as dotenv from 'dotenv';
import * as cookieParser from 'cookie-parser';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove campos não declarados no DTO
      forbidNonWhitelisted: true, // erro se passar campo não esperado
      transform: true, // transforma para a classe DTO
      exceptionFactory: (errors) => {
        // Função recursiva para extrair TODOS os erros
        const extractErrors = (errors: any[], parentPath = ''): any[] => {
          const allErrors: any[] = [];
          
          errors.forEach(error => {
            const currentPath = parentPath 
              ? `${parentPath}.${error.property}` 
              : error.property;
            
            if (error.constraints) {
              allErrors.push({
                property: currentPath,
                value: error.value,
                constraints: error.constraints
              });
            }
            
            if (error.children && error.children.length > 0) {
              allErrors.push(...extractErrors(error.children, currentPath));
            }
          });
          
          return allErrors;
        };
        
        const detailedErrors = extractErrors(errors);
        
        console.log('\n ERROS DE VALIDAÇÃO:');
        console.log(JSON.stringify(detailedErrors, null, 2));
        
        return new BadRequestException({
          statusCode: 400,
          message: 'Validation failed',
          errors: detailedErrors
        });
      },
    }),
  );

  const port = process.env.PORT ?? 3000; 
  await app.listen(port);

  logger.log(`🚀🚀🚀 Backend-Nest rodando na porta ${port} 🚀🚀🚀`, '#00b8b9');
}
bootstrap();
