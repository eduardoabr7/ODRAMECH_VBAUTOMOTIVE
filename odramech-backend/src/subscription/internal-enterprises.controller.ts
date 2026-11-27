import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { AppConfig } from 'src/core/config/app-config';
import { PrismaService } from 'src/core/database/prisma.service';
import { Public } from 'src/shared/decorators/public-routes.decorator';

/** confere a chave serviço‑a‑serviço em tempo constante */
export function assertServiceKey(config: AppConfig, provided: string | undefined): void {
  const expected = Buffer.from(config.values.subscriptions.apiKey);
  const given = Buffer.from(provided ?? '');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw new UnauthorizedException('API key inválida.');
  }
}

/**
 * Lista de empresas para o painel administrativo de assinaturas.
 * Só o serviço de assinaturas chama (x-api-key) — nunca o navegador.
 */
@Controller('internal')
export class InternalEnterprisesController {
  constructor(private readonly prisma: PrismaService, private readonly config: AppConfig) {}

  @Public()
  @Get('enterprises')
  list(@Headers('x-api-key') key: string | undefined) {
    assertServiceKey(this.config, key);
    return this.prisma.enterprise.findMany({
      select: { id: true, name: true, cnpj: true, email: true, phone: true },
      orderBy: { id: 'asc' },
    });
  }
}
