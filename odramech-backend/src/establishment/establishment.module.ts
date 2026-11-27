import { Module } from "@nestjs/common";
import { EstablishmentController } from "./controllers/establishment.controller";
import { EstablishmentService } from "./services/establishment.service";
import { SubscriptionModule } from "src/subscription/subscription.module";

@Module({
    imports: [SubscriptionModule],
    providers: [EstablishmentService],
    controllers: [EstablishmentController]
})
export class EstablishmentModule {
}