import { Module } from "@nestjs/common";
import { NoPublicRoutesGuard } from "./guards/no-public-routes.guard";
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from "src/prisma/prisma-service";

@Module({
    imports: [AuthModule],
    providers: [NoPublicRoutesGuard, PrismaService],
    controllers:[],
    exports: [NoPublicRoutesGuard]
})

export class SharedModule{}
