import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseIntPipe, Post, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminActor, AdminLicenseService } from '../application/admin-license.service';
import { SubscriptionsConfig } from '../config/subscriptions-config';
import { AdminRoute, PublicRoute, readCookie } from '../http/api-key.guard';
import { ADMIN_COOKIE, AdminAuthService, AdminPrincipal } from './admin-auth.service';
import {
  AdminLoginDTO, ChangePlanDTO, ComplimentaryDTO, CreatePlanDTO, NoteDTO, PeriodDTO, StartTrialDTO, SuspendDTO, UpdatePlanDTO,
} from './admin.dto';

export const ADMIN_LICENSE_SERVICE = Symbol('AdminLicenseService');

const actorOf = (req: Request): AdminActor => {
  const a = (req as any).admin as AdminPrincipal;
  return { id: a.id, email: a.email };
};

function cookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    secure: SubscriptionsConfig.get().values.isProduction,
    sameSite: 'strict' as const,
    path: '/',
    ...(expires && { expires }),
  };
}

@AdminRoute()
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @PublicRoute()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: AdminLoginDTO, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.email, dto.password, dto.totp, req.ip ?? null, req.headers['user-agent'] ?? null);
    res.cookie(ADMIN_COOKIE, result.token, cookieOptions(result.expiresAt));
    return { admin: result.admin, expiresAt: result.expiresAt };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(readCookie(req.headers.cookie, ADMIN_COOKIE));
    res.clearCookie(ADMIN_COOKIE, cookieOptions());
  }

  @Get('me')
  me(@Req() req: Request) {
    return (req as any).admin as AdminPrincipal;
  }
}

@AdminRoute()
@Controller('admin')
export class AdminLicensesController {
  constructor(@Inject(ADMIN_LICENSE_SERVICE) private readonly service: AdminLicenseService) {}

  @Get('dashboard')
  dashboard() { return this.service.dashboard(); }

  @Get('licenses')
  list() { return this.service.list(); }

  @Get('licenses/:enterpriseId')
  detail(@Param('enterpriseId', ParseIntPipe) id: number) { return this.service.detail(id); }

  @Post('licenses/:enterpriseId/trial')
  trial(@Param('enterpriseId', ParseIntPipe) id: number, @Body() dto: StartTrialDTO, @Req() req: Request) {
    return this.service.startTrial(actorOf(req), id, dto.enterpriseName ?? null, dto.days ?? null);
  }

  @Post('licenses/:enterpriseId/complimentary')
  complimentary(@Param('enterpriseId', ParseIntPipe) id: number, @Body() dto: ComplimentaryDTO, @Req() req: Request) {
    return this.service.grantComplimentary(actorOf(req), id, {
      planCode: dto.planCode,
      until: dto.until ? new Date(dto.until) : null,
      enterpriseName: dto.enterpriseName ?? null,
      ...(dto.note !== undefined && { note: dto.note || null }),
    });
  }

  @Delete('licenses/:enterpriseId/complimentary')
  revoke(@Param('enterpriseId', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.revokeComplimentary(actorOf(req), id);
  }

  @Post('licenses/:enterpriseId/plan')
  plan(@Param('enterpriseId', ParseIntPipe) id: number, @Body() dto: ChangePlanDTO, @Req() req: Request) {
    return this.service.changePlan(actorOf(req), id, dto.planCode);
  }

  @Post('licenses/:enterpriseId/period')
  period(@Param('enterpriseId', ParseIntPipe) id: number, @Body() dto: PeriodDTO, @Req() req: Request) {
    return this.service.setPeriodEnd(actorOf(req), id, new Date(dto.until), dto.status);
  }

  @Post('licenses/:enterpriseId/suspend')
  suspend(@Param('enterpriseId', ParseIntPipe) id: number, @Body() dto: SuspendDTO, @Req() req: Request) {
    return this.service.suspend(actorOf(req), id, dto.reason?.trim() || null);
  }

  @Delete('licenses/:enterpriseId/suspend')
  unsuspend(@Param('enterpriseId', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.unsuspend(actorOf(req), id);
  }

  @Put('licenses/:enterpriseId/note')
  note(@Param('enterpriseId', ParseIntPipe) id: number, @Body() dto: NoteDTO, @Req() req: Request) {
    return this.service.setNote(actorOf(req), id, dto.note?.trim() || null);
  }

  @Post('invoices/:invoiceId/mark-paid')
  markPaid(@Param('invoiceId') invoiceId: string, @Req() req: Request) {
    return this.service.markInvoicePaid(actorOf(req), invoiceId);
  }

  @Post('invoices/:invoiceId/void')
  void(@Param('invoiceId') invoiceId: string, @Req() req: Request) {
    return this.service.voidInvoice(actorOf(req), invoiceId);
  }

  @Get('plans')
  plans() { return this.service.listPlans(); }

  @Post('plans')
  createPlan(@Body() dto: CreatePlanDTO) {
    return this.service.createPlan({
      code: dto.code, name: dto.name, interval: dto.interval, priceCents: dto.priceCents, currency: 'BRL',
      description: dto.description ?? null, active: dto.active ?? true, sortOrder: dto.sortOrder ?? 99,
      tier: dto.tier ?? 1, maxEstablishments: dto.maxEstablishments ?? null, features: dto.features ?? [],
    });
  }

  @Put('plans/:id')
  updatePlan(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlanDTO) {
    return this.service.updatePlan(id, dto);
  }

  /** força uma rodada do agendador (renovação/expiração) */
  @Post('run-lifecycle')
  run() { return this.service.runLifecycle(); }
}
