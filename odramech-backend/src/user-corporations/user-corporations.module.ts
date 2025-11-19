import { Module } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";
import { UserCorporationService } from "./services/user-corporation.service";
import { UserCorporationController } from "./controllers/user-corporation.controller";

@Module({
    imports: [],
    controllers: [UserCorporationController],
    providers: [UserCorporationService, PrismaService],
})
    
export class UserCorporationModule {}