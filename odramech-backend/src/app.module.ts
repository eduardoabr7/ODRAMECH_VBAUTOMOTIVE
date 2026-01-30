import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { validationSchema } from './variables-required';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { CustomLogger } from './shared/services/custom-logger.service';
import { APP_GUARD } from '@nestjs/core'
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard'
import { SharedModule } from './shared/shared.module';
import { EnterpriseModule } from './enterprise/enterprise.module';
import { EstablishmentModule } from './establishment/establishment.module';
import { UserCorporationModule } from './user-corporations/user-corporations.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: true
      }
    }),
    UserModule,
    AuthModule,
    SharedModule,
    EnterpriseModule,
    EstablishmentModule,
    UserCorporationModule
  ],
  controllers: [AppController],
  providers: [
    AppService, 
    CustomLogger,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    }
  ],
})
export class AppModule {}
