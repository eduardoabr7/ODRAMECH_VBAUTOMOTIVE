import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, Req } from "@nestjs/common";
import { VehicleService } from "../services/vehicle.service";
import { CreateVehicleDTO } from "../dto/create-vehicle.dto";
import { LinkVehicleDTO, UpdateVehicleDTO } from "../dto/update-vehicle.dto";
import { CustomLogger } from "src/shared/services/custom-logger.service";
import { AuthPayload } from "src/auth/interfaces/auth-payload.interface";
import { assertStaff } from "src/shared/utils/role.util";

@Controller('vehicle')
export class VehicleController {

    private readonly logger = new CustomLogger()

    constructor(
        private readonly _vehicleService: VehicleService,
    ){
        this.logger.setContextModule(VehicleController.name);
    }

    @Post()
    createVehicle(@Body() data: CreateVehicleDTO, @Req() req) {
        assertStaff((req.authContext as AuthPayload).role);
        return this._vehicleService.createVehicle(data)
    }

    @Get()
    listByEstablishment(@Req() req, @Query('search') search?: string) {
        return this._vehicleService.listByEstablishment(req.authContext as AuthPayload, search);
    }

    @Get('check-plate/:plate')
    checkPlate(@Param('plate') plate: string) {
        return this._vehicleService.checkPlate(plate);
    }

    @Post('link')
    link(@Body() data: LinkVehicleDTO, @Req() req) {
        assertStaff((req.authContext as AuthPayload).role);
        return this._vehicleService.linkToUser(data.vehicleId, data.userId);
    }

    @Get('user/:userId')
    getUserVehicles(@Param('userId', ParseIntPipe) userId: number) {
        return this._vehicleService.getByUser(userId)
    }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateVehicleDTO, @Req() req) {
        assertStaff((req.authContext as AuthPayload).role);
        return this._vehicleService.update(id, data);
    }
}
