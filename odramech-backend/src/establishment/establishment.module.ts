import { Module } from "@nestjs/common";
import { EstablishmentController } from "./controllers/establishment.controller";
import { EstablishmentService } from "./services/establishment.service";
import { PrismaService } from "src/prisma/prisma-service";

@Module({
    imports: [],
    providers: [EstablishmentService, PrismaService],
    controllers: [EstablishmentController]
})
export class EstablishmentModule {
}