import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { CurrentAuth } from 'src/core/auth/current-auth.decorator';
import { ContractedModule } from 'src/contracted-modules/contracted-module';
import { RequiresModule } from 'src/contracted-modules/requires-module.decorator';
import { AllowWhenBlocked } from 'src/subscription/allow-when-blocked.decorator';
import { InventoryService } from './inventory.service';
import { MovementListQueryDTO, PartCreateDTO, PartListQueryDTO, PartStatusDTO, PartUpdateDTO, StockMovementDTO } from './dto/inventory.dto';

/**
 * Módulo Estoque. O controller inteiro exige o contrato (@RequiresModule); as consultas têm
 * @AllowWhenBlocked para continuarem visíveis (somente leitura) com a assinatura bloqueada.
 */
@RequiresModule(ContractedModule.INVENTORY)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @AllowWhenBlocked()
  @Get('parts')
  list(@Query() q: PartListQueryDTO, @CurrentAuth() auth: AuthPayload) { return this.inventory.list(auth, q); }

  @AllowWhenBlocked()
  @Get('summary')
  summary(@CurrentAuth() auth: AuthPayload) { return this.inventory.summary(auth); }

  @AllowWhenBlocked()
  @Get('parts/:id')
  get(@Param('id', ParseIntPipe) id: number, @CurrentAuth() auth: AuthPayload) { return this.inventory.get(auth, id); }

  @AllowWhenBlocked()
  @Get('movements')
  movements(@Query() q: MovementListQueryDTO, @CurrentAuth() auth: AuthPayload) { return this.inventory.movements(auth, q); }

  @Post('parts')
  create(@Body() dto: PartCreateDTO, @CurrentAuth() auth: AuthPayload) { return this.inventory.create(auth, dto); }

  @Put('parts/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: PartUpdateDTO, @CurrentAuth() auth: AuthPayload) {
    return this.inventory.update(auth, id, dto);
  }

  @Put('parts/:id/status')
  status(@Param('id', ParseIntPipe) id: number, @Body() dto: PartStatusDTO, @CurrentAuth() auth: AuthPayload) {
    return this.inventory.setActive(auth, id, dto.active);
  }

  @Post('parts/:id/movements')
  move(@Param('id', ParseIntPipe) id: number, @Body() dto: StockMovementDTO, @CurrentAuth() auth: AuthPayload) {
    return this.inventory.move(auth, id, dto);
  }
}
