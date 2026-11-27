import { Injectable } from '@nestjs/common';
import { QuoteStatus } from '@prisma/client';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { QuoteRepository } from 'src/billing/repositories/billing.repositories';
import { isStaff } from 'src/shared/utils/role.util';
import { sumItems } from 'src/shared/utils/money.util';
import { ExportQueryDTO } from '../dto/export-query.dto';
import { ExportSource, MAX_EXPORT_ROWS, Sheet, Workbook } from '../domain/spreadsheet';

const STATUS_LABEL: Record<QuoteStatus, string> = {
  RASCUNHO: 'Rascunho', ENVIADO: 'Enviado', APROVADO: 'Aprovado', RECUSADO: 'Recusado', EXPIRADO: 'Expirado',
};

@Injectable()
export class QuotesExportSource extends ExportSource {
  readonly kind = 'quotes';
  readonly fileName = 'orcamentos';
  readonly staffOnly = false;

  constructor(private readonly quotes: QuoteRepository) { super(); }

  async build(auth: AuthPayload, q: ExportQueryDTO): Promise<Workbook> {
    const status = Object.values(QuoteStatus).includes(q.status as QuoteStatus) ? (q.status as QuoteStatus) : undefined;
    const rows = await this.quotes.list({
      establishmentId: auth.establishmentId,
      ...(isStaff(auth.role) ? {} : { onlyClientId: auth.sub }),
      status,
      term: q.search?.trim() || undefined,
    }, MAX_EXPORT_ROWS);

    const sheet: Sheet = {
      name: 'Orçamentos',
      rows,
      columns: [
        { header: 'Nº', value: r => r.numberQuote, format: 'int', width: 8 },
        { header: 'Status', value: r => STATUS_LABEL[r.status as QuoteStatus] ?? r.status, width: 12 },
        { header: 'Criado em', value: r => r.createdAt, format: 'datetime' },
        { header: 'Validade', value: r => r.validUntil, format: 'date' },
        { header: 'Cliente', value: r => r.client?.name, width: 28 },
        { header: 'Telefone', value: r => r.client?.principalPhone, width: 16 },
        { header: 'Veículo', value: r => [r.vehicle?.make, r.vehicle?.name].filter(Boolean).join(' '), width: 24 },
        { header: 'Placa', value: r => r.vehicle?.plate, width: 10 },
        { header: 'Criado por', value: r => r.userCreation?.name },
        { header: 'Itens', value: r => r.items.length, format: 'int', width: 8 },
        { header: 'Total', value: r => sumItems(r.items), format: 'money', total: true },
        { header: 'OS gerada', value: r => (r.workOrder ? r.workOrder.numberOs : null), format: 'int', width: 10 },
        { header: 'Observações', value: r => r.notes, width: 40 },
      ],
    };
    return { title: 'Orçamentos', sheets: [sheet] };
  }
}
