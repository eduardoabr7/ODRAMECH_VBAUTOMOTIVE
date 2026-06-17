import { Body, Controller, Post } from "@nestjs/common";
import { VehicleService } from "../services/vehicle.service";
import { CreateVehicleDTO } from "../dto/create-vehicle.dto";

@Controller('vehicle')
export class VehicleController {
    
    constructor(
        private readonly _vehicleService: VehicleService
    ){}

    @Post('create')
    createUser(@Body() data: CreateVehicleDTO) {
        return this._vehicleService.createVehicle(data)
    }

}