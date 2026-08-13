import { Body, Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import { VehicleService } from "../services/vehicle.service";
import { CreateVehicleDTO } from "../dto/create-vehicle.dto";
import { CustomLogger } from "src/shared/services/custom-logger.service";

@Controller('vehicle')
export class VehicleController {

    private readonly logger = new CustomLogger()
    
    constructor(
        private readonly _vehicleService: VehicleService,
    ){
        this.logger.setContextModule(VehicleController.name);
    }

    @Post()
    createUser(@Body() data: CreateVehicleDTO) {
        return this._vehicleService.createVehicle(data)
    }


    @Get('user/:userId')
    getUserVehicles(@Param('userId', ParseIntPipe) userId: number) {
        return this._vehicleService.getByUser(userId)
    }
}