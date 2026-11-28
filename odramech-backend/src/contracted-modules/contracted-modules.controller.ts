import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { CurrentAuth } from 'src/core/auth/current-auth.decorator';
import { AppConfig } from 'src/core/config/app-config';
import { Public } from 'src/shared/decorators/public-routes.decorator';
import { AllowWhenBlocked } from 'src/subscription/allow-when-blocked.decorator';
import { assertServiceKey } from 'src/subscription/internal-enterprises.controller';
import { ContractedModule } from './contracted-module';
import { ModuleAccessService } from './module-access.service';

class ModuleContractEventDTO {
  @IsInt() enterpriseId: number;
  @IsIn(Object.values(ContractedModule)) module: ContractedModule;
  @IsOptional() @IsString() @MaxLength(60) type?: string;
}

@Controller('modules')
export class ContractedModulesController {
  constructor(private readonly access: ModuleAccessService) {}

  /** quais módulos a empresa da sessão tem — o frontend usa só para mostrar/esconder telas */
  @AllowWhenBlocked()
  @Get()
  async list(@CurrentAuth() auth: AuthPayload) {
    const { modules } = await this.access.of(auth.enterpriseId);
    return { modules: modules.map(m => ({ module: m.module, active: m.active, until: m.until })) };
  }
}

/** Aviso do serviço de assinaturas: contrato de módulo mudou → limpa o cache na hora. */
@Controller('internal')
export class ModuleContractWebhookController {
  constructor(private readonly access: ModuleAccessService, private readonly config: AppConfig) {}

  @Public()
  @Post('module-contract-events')
  @HttpCode(204)
  receive(@Headers('x-api-key') key: string | undefined, @Body() event: ModuleContractEventDTO) {
    assertServiceKey(this.config, key);
    this.access.invalidate(event.enterpriseId);
  }
}
