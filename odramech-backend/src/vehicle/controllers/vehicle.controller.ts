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
        const auth = req.authContext as AuthPayload;
        assertStaff(auth.role);
        return this._vehicleService.createVehicle(auth, data)
    }

    @Get()
    listByEstablishment(@Req() req, @Query('search') search?: string) {
        return this._vehicleService.listByEstablishment(req.authContext as AuthPayload, search);
    }

    @Get('check-plate/:plate')
    checkPlate(@Param('plate') plate: string, @Req() req) {
        assertStaff((req.authContext as AuthPayload).role);
        return this._vehicleService.checkPlate(plate);
    }

    @Post('link')
    link(@Body() data: LinkVehicleDTO, @Req() req) {
        const auth = req.authContext as AuthPayload;
        assertStaff(auth.role);
        return this._vehicleService.linkToUser(auth, data.vehicleId, data.userId);
    }

    /** veículos de uma pessoa: a própria pessoa, ou a equipe do estabelecimento onde ela é cliente */
    @Get('user/:userId')
    getUserVehicles(@Param('userId', ParseIntPipe) userId: number, @Req() req) {
        return this._vehicleService.getByUser(req.authContext as AuthPayload, userId)
    }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateVehicleDTO, @Req() req) {
        const auth = req.authContext as AuthPayload;
        assertStaff(auth.role);
        return this._vehicleService.update(auth, id, data);
    }
}
