import { Body, Controller, Get, Headers, HttpCode, Param, Post, UnauthorizedException } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { timingSafeEqual } from 'node:crypto';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { CurrentAuth } from 'src/core/auth/current-auth.decorator';
import { AppConfig } from 'src/core/config/app-config';
import { Public } from 'src/shared/decorators/public-routes.decorator';
import { SubscriptionFacade } from './subscription.facade';

const METHODS = ['PIX', 'CARD', 'BOLETO'] as const;

class SelectPlanDTO {
  @IsString() @MaxLength(40) planCode: string;
  @IsIn(METHODS) method: (typeof METHODS)[number];
}

class PayDTO {
  @IsIn(METHODS) method: (typeof METHODS)[number];
  @IsOptional() @IsString() @MaxLength(200) cardToken?: string;
}

class SubscriptionEventDTO {
  @IsInt() enterpriseId: number;
  @IsString() type: string;
  @IsOptional() subscriptionId?: string;
  @IsOptional() status?: string;
  @IsOptional() data?: unknown;
  @IsOptional() occurredAt?: string;
  /** autor da ação quando veio do painel administrativo */
  @IsOptional() @IsString() @MaxLength(200) actor?: string;
}

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly facade: SubscriptionFacade) {}

  @Get()
  overview(@CurrentAuth() auth: AuthPayload) { return this.facade.overview(auth); }

  @Get('access')
  access(@CurrentAuth() auth: AuthPayload) { return this.facade.access(auth); }

  @Post('plan')
  selectPlan(@Body() dto: SelectPlanDTO, @CurrentAuth() auth: AuthPayload) {
    return this.facade.selectPlan(auth, dto.planCode, dto.method);
  }

  @Post('invoices/:invoiceId/pay')
  pay(@Param('invoiceId') invoiceId: string, @Body() dto: PayDTO, @CurrentAuth() auth: AuthPayload) {
    return this.facade.pay(auth, invoiceId, dto.method, dto.cardToken);
  }

  @Post('invoices/:invoiceId/simulate-payment')
  simulate(@Param('invoiceId') invoiceId: string, @CurrentAuth() auth: AuthPayload) {
    return this.facade.simulate(auth, invoiceId);
  }

  @Post('cancel')
  cancel(@CurrentAuth() auth: AuthPayload) { return this.facade.cancel(auth); }

  @Post('resume')
  resume(@CurrentAuth() auth: AuthPayload) { return this.facade.resume(auth); }
}

/** Webhook do serviço de assinaturas → invalida cache. Autenticado por API key, não por JWT. */
@Controller('internal')
export class SubscriptionWebhookController {
  constructor(private readonly facade: SubscriptionFacade, private readonly config: AppConfig) {}

  @Public()
  @Post('subscription-events')
  @HttpCode(204)
  receive(@Headers('x-api-key') key: string | undefined, @Body() event: SubscriptionEventDTO) {
    const expected = Buffer.from(this.config.values.subscriptions.apiKey);
    const provided = Buffer.from(key ?? '');
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      throw new UnauthorizedException('API key inválida.');
    }
    this.facade.onSubscriptionEvent(event.enterpriseId);
  }
}
