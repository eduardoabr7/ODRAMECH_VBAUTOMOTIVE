import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { CurrentAuth } from 'src/core/auth/current-auth.decorator';
import { CommandBus } from 'src/core/commands/command-bus';
import { assertStaff } from 'src/shared/utils/role.util';
import { WorkOrderService } from '../services/work-order.service';
import { WorkOrderCommandFactory } from '../commands/work-order.commands';
import { WoCreateFrontDTO } from '../dto/wo-create-front.dto';
import { WoListQueryDTO, WoUpdateResponsibleDTO, WoUpdateStatusDTO } from '../dto/wo-update.dto';
import { AppointmentCreateFrontDTO } from '../dto/appointment-create-front.dto';

class UndoDTO {
  @IsUUID()
  token: string;
}

@Controller('workorder')
export class WorkOrderController {
  constructor(
    private readonly workOrders: WorkOrderService,
    private readonly commands: WorkOrderCommandFactory,
    private readonly bus: CommandBus,
  ) {}

  @Post()
  create(@Body() dto: WoCreateFrontDTO, @CurrentAuth() auth: AuthPayload) {
    assertStaff(auth.role);
    return this.workOrders.open(auth, dto);
  }

  @Get()
  list(@Query() query: WoListQueryDTO, @CurrentAuth() auth: AuthPayload) {
    return this.workOrders.list(auth, query);
  }

  /** desfaz a última ação reversível (status/responsável) — válido por 30s */
  @Post('undo')
  async undo(@Body() dto: UndoDTO, @CurrentAuth() auth: AuthPayload) {
    const label = await this.bus.undo(dto.token, auth.sub);
    return { undone: label };
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number, @CurrentAuth() auth: AuthPayload) {
    return this.workOrders.getById(auth, id);
  }

  @Put(':id/status')
  async updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: WoUpdateStatusDTO, @CurrentAuth() auth: AuthPayload) {
    const { undoToken } = await this.bus.dispatch(this.commands.changeStatus(auth, id, dto.status), auth.sub);
    return { ...(await this.workOrders.getById(auth, id)), undoToken };
  }

  @Put(':id/responsible')
  async updateResponsible(@Param('id', ParseIntPipe) id: number, @Body() dto: WoUpdateResponsibleDTO, @CurrentAuth() auth: AuthPayload) {
    const { undoToken } = await this.bus.dispatch(this.commands.assignResponsible(auth, id, dto.userResponsibleId ?? null), auth.sub);
    return { ...(await this.workOrders.getById(auth, id)), undoToken };
  }

  @Post(':id/appointments')
  async addAppointment(@Param('id', ParseIntPipe) id: number, @Body() dto: AppointmentCreateFrontDTO, @CurrentAuth() auth: AuthPayload) {
    const { result } = await this.bus.dispatch(this.commands.addAppointment(auth, id, dto.contentHtml, dto.appointmentType), auth.sub);
    return result;
  }
}
