import { Body, Controller, Get, Header, HttpCode, Param, Post, Put, UnauthorizedException } from '@nestjs/common';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { CurrentAuth } from 'src/core/auth/current-auth.decorator';
import { Public } from 'src/shared/decorators/public-routes.decorator';
import { assertStaff } from 'src/shared/utils/role.util';
import { BrandingDTO, QuoteDocumentPreviewDTO, QuoteDocumentSettingsDTO } from '../dto/settings.dto';
import { SettingsService } from '../services/settings.service';
import { MailSettingsService } from '../services/mail-settings.service';
import { MailSettingsDTO, MailTestDTO } from '../dto/mail-settings.dto';

/** configurações exigem sessão completa (com empresa/estabelecimento escolhidos) */
function full(auth: AuthPayload): AuthPayload {
  if (auth.context !== 'AUTH' || !auth.enterpriseId) throw new UnauthorizedException('Escolha o estabelecimento para continuar.');
  return auth;
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService, private readonly mailSettings: MailSettingsService) {}

  // ── E-mail de envio (SMTP próprio da empresa) ──
  @Get('mail')
  mail(@CurrentAuth() auth: AuthPayload) { return this.mailSettings.get(full(auth)); }

  @Put('mail')
  saveMail(@Body() dto: MailSettingsDTO, @CurrentAuth() auth: AuthPayload) { return this.mailSettings.save(full(auth), dto); }

  @Post('mail/test')
  @HttpCode(200)
  testMail(@Body() dto: MailTestDTO, @CurrentAuth() auth: AuthPayload) { return this.mailSettings.test(full(auth), dto); }

  /** configuração do documento de orçamento + dados do estabelecimento para a impressão */
  @Get('quote-document')
  quoteDocument(@CurrentAuth() auth: AuthPayload) {
    assertStaff(full(auth).role);
    return this.settings.quoteDocument(auth);
  }

  /** HTML de pré-visualização (orçamento de exemplo + rascunho da configuração) */
  @Post('quote-document/preview')
  @Header('Content-Type', 'text/html; charset=utf-8')
  previewQuoteDocument(@Body() dto: QuoteDocumentPreviewDTO, @CurrentAuth() auth: AuthPayload) {
    assertStaff(full(auth).role);
    return this.settings.previewQuoteDocument(auth, dto);
  }

  @Put('quote-document')
  saveQuoteDocument(@Body() dto: QuoteDocumentSettingsDTO, @CurrentAuth() auth: AuthPayload) {
    return this.settings.saveQuoteSettings(full(auth), dto);
  }

  @Get('branding')
  branding(@CurrentAuth() auth: AuthPayload) {
    return this.settings.branding(full(auth));
  }

  @Put('branding')
  saveBranding(@Body() dto: BrandingDTO, @CurrentAuth() auth: AuthPayload) {
    return this.settings.saveBranding(full(auth), dto);
  }
}

/** Tema para a tela de login (antes da autenticação). */
@Controller('branding')
export class PublicBrandingController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get('public/:key')
  publicBranding(@Param('key') key: string) {
    return this.settings.publicBranding(key);
  }
}
