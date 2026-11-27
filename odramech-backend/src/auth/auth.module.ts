import { Module } from "@nestjs/common";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.service";
import { BcryptService } from "src/crypto/bcrypt.service";
import { JwtModule } from "@nestjs/jwt";
import { AppConfig } from "src/core/config/app-config";
import { JWTService } from "./services/jwt.service";
import { CustomLogger } from "src/shared/services/custom-logger.service";
import { EmailMaskService } from "src/shared/services/mask-email.service";
import { UserCorporationService } from "src/user-corporations/services/user-corporation.service";
import { LoginAttemptsService } from "./services/login-attempts.service";

@Module({
    imports: [
        // segredo vem do AppConfig (validado), não de process.env no momento do import
        JwtModule.registerAsync({
            useFactory: () => {
                const { jwtSecret, jwtExpires } = AppConfig.get().values;
                return { secret: jwtSecret, signOptions: { expiresIn: jwtExpires } };
            },
        })
    ],
    controllers: [AuthController],
    providers: [
        AuthService, 
        JWTService, 
        BcryptService,
        CustomLogger,
        EmailMaskService,
        UserCorporationService,
        LoginAttemptsService,
    ],
    exports: [
        JWTService
    ]
})

export class AuthModule {}