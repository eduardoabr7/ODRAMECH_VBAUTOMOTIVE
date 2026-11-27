import { Module } from '@nestjs/common';
import { BillingModule } from 'src/billing/billing.module';
import { WorkOrderModule } from 'src/work-order/work-order.module';
import { SpreadsheetWriter } from './domain/spreadsheet';
import { ExportController } from './export.controller';
import { EXPORT_SOURCES, ExportService } from './export.service';
import { ClientsExportSource } from './sources/clients.export-source';
import { PaymentsExportSource } from './sources/payments.export-source';
import { QuotesExportSource } from './sources/quotes.export-source';
import { VehiclesExportSource } from './sources/vehicles.export-source';
import { WorkOrdersExportSource } from './sources/work-orders.export-source';
import { ExcelJsSpreadsheetWriter } from './writers/exceljs-spreadsheet.writer';

const SOURCES = [WorkOrdersExportSource, QuotesExportSource, ClientsExportSource, VehiclesExportSource, PaymentsExportSource];

/**
 * Exportação para planilha. Novo documento = nova ExportSource nesta lista.
 * Trocar o formato (ex.: CSV/ODS) = outro SpreadsheetWriter na linha do provide.
 */
@Module({
  imports: [WorkOrderModule, BillingModule],
  controllers: [ExportController],
  providers: [
    ...SOURCES,
    { provide: EXPORT_SOURCES, useFactory: (...sources) => sources, inject: SOURCES },
    { provide: SpreadsheetWriter, useClass: ExcelJsSpreadsheetWriter },
    ExportService,
  ],
})
export class ExportModule {}
