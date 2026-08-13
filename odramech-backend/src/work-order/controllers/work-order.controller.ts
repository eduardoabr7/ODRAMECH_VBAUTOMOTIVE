import { Body, Controller, Get, Param, ParseIntPipe, Post, Req } from "@nestjs/common";
import { CustomLogger } from "src/shared/services/custom-logger.service";
import { WorkOrderService } from "../services/work-order.service";
import { WoCreateDTO } from "../dto/wo-create.dto";
import { WoCreateFrontDTO } from "../dto/wo-create-front.dto";
import { RequestWithUser } from "src/auth/dto/request-with-user.dto";

@Controller('workorder')
export class WorkOrderController {

    private readonly logger = new CustomLogger();

    constructor(
        private readonly _workOrderService: WorkOrderService,
    ) {
        this.logger.setContextModule(WorkOrderController.name);
    }

    @Post()
    async create(@Body() dto: WoCreateFrontDTO, @Req() req) {
      const data: WoCreateDTO = {
        ...dto,
        establishmentId: req.authContext.establishmentId,
        userCreationId: req.authContext.sub,
        appointment: dto.appointment
          ? { ...dto.appointment, userAppointmentId: req.authContext.sub }
          : undefined,
      };

      return this._workOrderService.create(data);
    }
}