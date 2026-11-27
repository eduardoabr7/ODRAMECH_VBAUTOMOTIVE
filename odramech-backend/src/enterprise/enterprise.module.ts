import { Module } from "@nestjs/common";
import { EnterpriseController } from "./controllers/enterprise.controller";
import { EnterpriseService } from "./services/enterprise.service";

@Module({
    imports: [],
    providers: [EnterpriseService],
    controllers: [EnterpriseController]
})
export class EnterpriseModule {
}