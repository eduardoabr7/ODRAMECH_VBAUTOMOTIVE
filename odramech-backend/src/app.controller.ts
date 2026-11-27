import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './shared/decorators/public-routes.decorator';
import { PrismaService } from './prisma/prisma-service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly _prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Usado pelo frontend para detectar queda/retorno da conexão. Público e barato. */
  @Public()
  @Get('health')
  async health() {
    let database = true;
    try {
      await this._prisma.$queryRaw`SELECT 1`;
    } catch {
      database = false;
    }
    return { status: database ? 'ok' : 'degraded', database, time: new Date().toISOString() };
  }
}
