import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { ExportQueryDTO } from '../dto/export-query.dto';

/** como a célula é formatada na planilha */
export type CellFormat = 'text' | 'int' | 'money' | 'decimal' | 'date' | 'datetime';
export type CellValue = string | number | Date | null | undefined;

export interface SheetColumn<T> {
  header: string;
  value: (row: T) => CellValue;
  format?: CellFormat;
  /** largura em caracteres (padrão calculado pelo formato) */
  width?: number;
  /** soma a coluna numa linha de total no fim */
  total?: boolean;
}

export interface Sheet<T = any> {
  name: string;
  columns: SheetColumn<T>[];
  rows: T[];
}

export interface Workbook {
  title: string;
  sheets: Sheet[];
}

/** teto de linhas por exportação (protege memória do servidor) */
export const MAX_EXPORT_ROWS = 10_000;

/**
 * STRATEGY — cada documento exportável sabe buscar seus dados e montar suas abas.
 * Novo documento = nova classe registrada em export.module.ts (Aberto/Fechado).
 */
export abstract class ExportSource {
  /** usado na URL: GET /export/:kind */
  abstract readonly kind: string;
  /** nome do arquivo (sem data/extensão) */
  abstract readonly fileName: string;
  /** só a equipe exporta? (cliente exporta só o que é dele, se false) */
  abstract readonly staffOnly: boolean;

  abstract build(auth: AuthPayload, query: ExportQueryDTO): Promise<Workbook>;
}

/** PORTA — transforma o Workbook em arquivo. A implementação (ExcelJS) fica no adapter. */
export abstract class SpreadsheetWriter {
  abstract readonly mimeType: string;
  abstract readonly extension: string;
  abstract write(workbook: Workbook): Promise<Buffer>;
}
