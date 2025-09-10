import { Module } from "@nestjs/common";
import { EnterpriseController } from "./controllers/enterprise.controller";
import { EnterpriseService } from "./services/enterprise.service";
import { PrismaService } from "src/prisma/prisma-service";

@Module({
    imports: [],
    providers: [EnterpriseService, PrismaService],
    controllers: [EnterpriseController]
})
export class EnterpriseModule {
}