import { Module } from "@nestjs/common";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.service";
import { PrismaService } from "src/prisma/prisma-service";
import { BcryptService } from "src/crypto/bcrypt.service";
import { JwtModule } from "@nestjs/jwt";
import { JWTService } from "./services/jwt.service";
import { CustomLogger } from "src/shared/custom-logger.service";
import { EmailMaskService } from "src/shared/mask-email.service";

@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET,
            signOptions: { expiresIn: process.env.JWT_EXPIRES }
        })
    ],
    controllers: [AuthController],
    providers: [
        AuthService, 
        JWTService,
        PrismaService, 
        BcryptService,
        CustomLogger,
        EmailMaskService
    ],
})

export class AuthModule {}