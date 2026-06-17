import { Module } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";
import { VehicleController } from "./controllers/vehicle.controller";
import { VehicleService } from "./services/vehicle.service";

@Module({
    imports: [],
    controllers: [VehicleController],
    providers: [VehicleService, PrismaService],
})
    
export class VehicleModule {}