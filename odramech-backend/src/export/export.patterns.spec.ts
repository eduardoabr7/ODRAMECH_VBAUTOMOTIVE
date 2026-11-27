import { Role } from '@prisma/client';
import { Workbook as ExcelWorkbook } from 'exceljs';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { EstablishmentScope } from 'src/core/auth/establishment-scope.service';
import { ExportSource, Workbook } from './domain/spreadsheet';
import { ExportService } from './export.service';
import { ExcelJsSpreadsheetWriter } from './writers/exceljs-spreadsheet.writer';

const staff: AuthPayload = { sub: 1, role: Role.ADMIN, establishmentId: 10, enterpriseId: 5, context: 'AUTH' as any };
const client: AuthPayload = { ...staff, sub: 99, role: Role.USER };

class FakeSource extends ExportSource {
  readonly kind = 'fake';
  readonly fileName = 'fake';
  constructor(readonly staffOnly: boolean) { super(); }
  async build(): Promise<Workbook> {
    return {
      title: 'Fake',
      sheets: [{
        name: 'Aba: com [caracteres]/inválidos e nome bem comprido demais',
        rows: [{ n: 'Ana', v: 10.5 }, { n: '=HYPERLINK("http://mal")', v: 4.5 }],
        columns: [
          { header: 'Nome', value: r => r.n },
          { header: 'Valor', value: r => r.v, format: 'money', total: true },
        ],
      }],
    };
  }
}

const scope = { resolve: async (a: AuthPayload) => a } as unknown as EstablishmentScope;

async function read(buffer: Buffer) {
  const wb = new ExcelWorkbook();
  await wb.xlsx.load(buffer as any);
  return wb.worksheets[0];
}

describe('Exportação para planilha (Strategy + Adapter + Facade)', () => {
  it('gera .xlsx com cabeçalho, linha de total em fórmula e nome de aba válido', async () => {
    const service = new ExportService([new FakeSource(false)], new ExcelJsSpreadsheetWriter(), scope);
    const file = await service.export(staff, 'fake', {});
    expect(file.fileName).toMatch(/^fake_\d{4}-\d{2}-\d{2}\.xlsx$/);

    const ws = await read(file.buffer);
    expect(ws.name.length).toBeLessThanOrEqual(31);
    expect(ws.name).not.toMatch(/[:\\/?*[\]]/);
    expect(ws.getRow(1).getCell(1).value).toBe('Nome');
    expect(ws.getRow(4).getCell(1).value).toBe('Total');
    expect((ws.getRow(4).getCell(2).value as any).formula).toBe('SUM(B2:B3)');
  });

  it('texto que começa com "=" não vira fórmula', async () => {
    const service = new ExportService([new FakeSource(false)], new ExcelJsSpreadsheetWriter(), scope);
    const ws = await read((await service.export(staff, 'fake', {})).buffer);
    expect(ws.getRow(3).getCell(1).value).toBe(`'=HYPERLINK("http://mal")`);
  });

  it('documento só da equipe recusa cliente; tipo desconhecido dá 404', async () => {
    const service = new ExportService([new FakeSource(true)], new ExcelJsSpreadsheetWriter(), scope);
    await expect(service.export(client, 'fake', {})).rejects.toThrow('permissão');
    await expect(service.export(staff, 'nada', {})).rejects.toThrow('não existe');
  });
});
