import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { EstablishmentScope } from 'src/core/auth/establishment-scope.service';
import { assertStaff } from 'src/shared/utils/role.util';
import { ExportQueryDTO } from './dto/export-query.dto';
import { ExportSource, SpreadsheetWriter } from './domain/spreadsheet';

/** token da lista de fontes registradas no módulo */
export const EXPORT_SOURCES = Symbol('EXPORT_SOURCES');

export interface ExportFile {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

/**
 * FACADE da exportação: escolhe a fonte pelo tipo (registry de Strategies), aplica o
 * estabelecimento escolhido e a permissão, e entrega o arquivo pronto ao controller.
 */
@Injectable()
export class ExportService {
  private readonly sources: Map<string, ExportSource>;

  constructor(
    @Inject(EXPORT_SOURCES) sources: ExportSource[],
    private readonly writer: SpreadsheetWriter,
    private readonly scope: EstablishmentScope,
  ) {
    this.sources = new Map(sources.map(s => [s.kind, s]));
  }

  kinds(): string[] { return [...this.sources.keys()]; }

  async export(sessionAuth: AuthPayload, kind: string, query: ExportQueryDTO): Promise<ExportFile> {
    const source = this.sources.get(kind);
    if (!source) throw new NotFoundException(`Exportação "${kind}" não existe.`);

    const auth = await this.scope.resolve(sessionAuth, query.establishmentId);
    if (source.staffOnly) assertStaff(auth.role);

    const workbook = await source.build(auth, query);
    const date = new Date().toISOString().slice(0, 10);
    return {
      buffer: await this.writer.write(workbook),
      fileName: `${source.fileName}_${date}.${this.writer.extension}`,
      mimeType: this.writer.mimeType,
    };
  }
}
