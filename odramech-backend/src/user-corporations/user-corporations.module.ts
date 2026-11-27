import { Module } from "@nestjs/common";
import { UserCorporationService } from "./services/user-corporation.service";
import { UserCorporationController } from "./controllers/user-corporation.controller";

@Module({
    imports: [],
    controllers: [UserCorporationController],
    providers: [UserCorporationService],
})
    
export class UserCorporationModule {}