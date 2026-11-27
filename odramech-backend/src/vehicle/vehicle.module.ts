import { Module } from "@nestjs/common";
import { VehicleController } from "./controllers/vehicle.controller";
import { VehicleService } from "./services/vehicle.service";

@Module({
    imports: [],
    controllers: [VehicleController],
    providers: [VehicleService],
})
    
export class VehicleModule {}