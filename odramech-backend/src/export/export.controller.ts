import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { CurrentAuth } from 'src/core/auth/current-auth.decorator';
import { ExportQueryDTO } from './dto/export-query.dto';
import { ExportService } from './export.service';

/** GET /export/:kind → planilha .xlsx (work-orders, quotes, clients, vehicles, payments). */
@Controller('export')
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  @Get(':kind')
  async download(@Param('kind') kind: string, @Query() query: ExportQueryDTO, @CurrentAuth() auth: AuthPayload, @Res() res: Response) {
    const file = await this.exports.export(auth, kind, query);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.buffer);
  }
}
