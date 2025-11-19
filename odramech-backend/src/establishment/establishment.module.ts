import { Module } from "@nestjs/common";
import { EstablishmentController } from "./controllers/establishment.controller";
import { EstablishmentService } from "./services/establishment.service";

@Module({
    imports: [],
    providers: [EstablishmentService],
    controllers: [EstablishmentController]
})
export class EstablishmentModule {
}