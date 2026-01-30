import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from "src/prisma/prisma-service";

@Module({
    imports: [AuthModule],
    providers: [JwtAuthGuard, PrismaService],
    controllers:[],
    exports: [JwtAuthGuard]
})

export class SharedModule{}
