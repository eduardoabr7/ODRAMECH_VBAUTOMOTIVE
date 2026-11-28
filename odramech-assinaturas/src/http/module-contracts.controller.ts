import { Body, Controller, Delete, Get, Inject, Param, ParseIntPipe, PipeTransform, Post, Put, Req, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { ModuleContractService } from '../application/module-contract.service';
import { AdminActor } from '../application/admin-license.service';
import { ContractModule, isContractModule } from '../domain/module-contract';
import { AdminPrincipal } from '../admin/admin-auth.service';
import { ModuleContractDTO, SuspendDTO } from '../admin/admin.dto';
import { AdminRoute } from './api-key.guard';

export const MODULE_CONTRACT_SERVICE = Symbol('ModuleContractService');

/** só aceita módulos conhecidos no path (nada de string livre chegando ao banco) */
class ParseModulePipe implements PipeTransform<string, ContractModule> {
  transform(value: string): ContractModule {
    const v = String(value ?? '').toUpperCase();
    if (!isContractModule(v)) throw new BadRequestException('Módulo desconhecido.');
    return v;
  }
}

const actorOf = (req: Request): AdminActor => {
  const a = (req as any).admin as AdminPrincipal;
  return { id: a.id, email: a.email };
};

/** Consulta do backend da oficina (x-api-key — guard padrão do serviço). */
@Controller('enterprises/:enterpriseId/modules')
export class EnterpriseModulesController {
  constructor(@Inject(MODULE_CONTRACT_SERVICE) private readonly service: ModuleContractService) {}

  @Get()
  access(@Param('enterpriseId', ParseIntPipe) id: number) {
    return this.service.access(id);
  }
}

/** Painel de licenças: só sessão de administrador (+ header anti-CSRF nas escritas). */
@AdminRoute()
@Controller('admin')
export class AdminModuleContractsController {
  constructor(@Inject(MODULE_CONTRACT_SERVICE) private readonly service: ModuleContractService) {}

  @Get('modules')
  catalog() { return this.service.catalog(); }

  @Get('module-contracts')
  summary() { return this.service.summary(); }

  @Get('licenses/:enterpriseId/modules')
  list(@Param('enterpriseId', ParseIntPipe) id: number) { return this.service.listForEnterprise(id); }

  @Put('licenses/:enterpriseId/modules/:module')
  activate(
    @Param('enterpriseId', ParseIntPipe) id: number,
    @Param('module', ParseModulePipe) module: ContractModule,
    @Body() dto: ModuleContractDTO,
    @Req() req: Request,
  ) {
    return this.service.activate(actorOf(req), id, module, {
      enterpriseName: dto.enterpriseName?.trim() || null,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      ...(dto.endsAt !== undefined && { endsAt: dto.endsAt ? new Date(dto.endsAt) : null }),
      ...(dto.priceCents !== undefined && { priceCents: dto.priceCents }),
      ...(dto.note !== undefined && { note: dto.note.trim() || null }),
    });
  }

  @Post('licenses/:enterpriseId/modules/:module/suspend')
  suspend(@Param('enterpriseId', ParseIntPipe) id: number, @Param('module', ParseModulePipe) module: ContractModule, @Body() dto: SuspendDTO, @Req() req: Request) {
    return this.service.suspend(actorOf(req), id, module, dto.reason?.trim() || null);
  }

  @Delete('licenses/:enterpriseId/modules/:module/suspend')
  unsuspend(@Param('enterpriseId', ParseIntPipe) id: number, @Param('module', ParseModulePipe) module: ContractModule, @Req() req: Request) {
    return this.service.unsuspend(actorOf(req), id, module);
  }

  @Post('licenses/:enterpriseId/modules/:module/cancel')
  cancel(@Param('enterpriseId', ParseIntPipe) id: number, @Param('module', ParseModulePipe) module: ContractModule, @Req() req: Request) {
    return this.service.cancel(actorOf(req), id, module);
  }
}
