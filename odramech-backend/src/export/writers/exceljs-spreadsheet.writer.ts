import { Injectable } from '@nestjs/common';
import { Workbook as ExcelWorkbook, Worksheet } from 'exceljs';
import { CellFormat, Sheet, SpreadsheetWriter, Workbook } from '../domain/spreadsheet';

const NUM_FMT: Partial<Record<CellFormat, string>> = {
  money: '"R$" #,##0.00;[Red]-"R$" #,##0.00',
  decimal: '#,##0.00',
  int: '0',
  date: 'dd/mm/yyyy',
  datetime: 'dd/mm/yyyy hh:mm',
};

const DEFAULT_WIDTH: Record<CellFormat, number> = { text: 22, int: 10, money: 15, decimal: 12, date: 12, datetime: 17 };

/** nome de aba aceito pelo Excel: até 31 caracteres, sem : \ / ? * [ ] */
function sheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31);
}

/** evita que texto vindo do usuário vire fórmula ao abrir no Excel (CSV/formula injection) */
function safeText(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

/** ADAPTER — escreve .xlsx com ExcelJS: cabeçalho fixo, filtro, formatos BR e linha de total. */
@Injectable()
export class ExcelJsSpreadsheetWriter extends SpreadsheetWriter {
  readonly mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  readonly extension = 'xlsx';

  async write(workbook: Workbook): Promise<Buffer> {
    const wb = new ExcelWorkbook();
    wb.creator = 'Odramech';
    wb.title = workbook.title;
    wb.created = new Date();

    for (const sheet of workbook.sheets) this.addSheet(wb, sheet);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private addSheet(wb: ExcelWorkbook, sheet: Sheet): void {
    const ws = wb.addWorksheet(sheetName(sheet.name), { views: [{ state: 'frozen', ySplit: 1 }] });

    ws.columns = sheet.columns.map(c => ({
      header: c.header,
      width: c.width ?? DEFAULT_WIDTH[c.format ?? 'text'],
      style: NUM_FMT[c.format ?? 'text'] ? { numFmt: NUM_FMT[c.format ?? 'text'] } : {},
    }));

    for (const row of sheet.rows) {
      ws.addRow(sheet.columns.map(c => {
        const v = c.value(row);
        if (v === null || v === undefined || v === '') return null;
        return typeof v === 'string' ? safeText(v) : v;
      }));
    }

    this.styleHeader(ws, sheet.columns.length);
    if (sheet.rows.length) {
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
      this.addTotals(ws, sheet);
    }
  }

  private styleHeader(ws: Worksheet, columns: number): void {
    const header = ws.getRow(1);
    header.height = 20;
    for (let i = 1; i <= columns; i++) {
      const cell = header.getCell(i);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF151515' } };
      cell.alignment = { vertical: 'middle' };
    }
  }

  /** linha "Total" com SUM (fórmula: continua certa se a pessoa filtrar/editar) */
  private addTotals(ws: Worksheet, sheet: Sheet): void {
    if (!sheet.columns.some(c => c.total)) return;
    const last = sheet.rows.length + 1;
    const row = ws.addRow(sheet.columns.map((c, i) => {
      if (i === 0) return 'Total';
      if (!c.total) return null;
      const col = ws.getColumn(i + 1).letter;
      return { formula: `SUM(${col}2:${col}${last})` };
    }));
    row.font = { bold: true };
    row.eachCell(cell => { cell.border = { top: { style: 'thin' } }; });
  }
}
