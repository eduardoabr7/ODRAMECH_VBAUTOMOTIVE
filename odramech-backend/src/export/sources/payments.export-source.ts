import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { PrismaService } from 'src/core/database/prisma.service';
import { toNum } from 'src/shared/utils/money.util';
import { ExportQueryDTO, periodOf } from '../dto/export-query.dto';
import { ExportSource, MAX_EXPORT_ROWS, Sheet, Workbook } from '../domain/spreadsheet';

const METHOD_LABEL: Record<PaymentMethod, string> = {
  DINHEIRO: 'Dinheiro', PIX: 'Pix', DEBITO: 'Débito', CREDITO: 'Crédito', BOLETO: 'Boleto',
};

/** Financeiro: pagamentos recebidos (período opcional) + resumo por forma de pagamento. */
@Injectable()
export class PaymentsExportSource extends ExportSource {
  readonly kind = 'payments';
  readonly fileName = 'financeiro-pagamentos';
  readonly staffOnly = true;

  constructor(private readonly prisma: PrismaService) { super(); }

  async build(auth: AuthPayload, q: ExportQueryDTO): Promise<Workbook> {
    const period = periodOf(q);
    const payments = await this.prisma.payment.findMany({
      where: { workOrder: { establishmentId: auth.establishmentId }, ...(period && { paidAt: period }) },
      include: {
        user: { select: { name: true } },
        workOrder: { select: { numberOs: true, client: { select: { name: true } }, vehicle: { select: { plate: true } } } },
      },
      orderBy: { paidAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    });

    const list: Sheet<(typeof payments)[number]> = {
      name: 'Pagamentos',
      rows: payments,
      columns: [
        { header: 'Data', value: p => p.paidAt, format: 'datetime' },
        { header: 'Nº OS', value: p => p.workOrder.numberOs, format: 'int', width: 8 },
        { header: 'Cliente', value: p => p.workOrder.client.name, width: 28 },
        { header: 'Placa', value: p => p.workOrder.vehicle.plate, width: 10 },
        { header: 'Forma', value: p => METHOD_LABEL[p.method], width: 11 },
        { header: 'Valor', value: p => toNum(p.amount), format: 'money', total: true },
        { header: 'Registrado por', value: p => p.user.name },
      ],
    };

    const byMethod = Object.values(PaymentMethod).map(method => {
      const of = payments.filter(p => p.method === method);
      return { method, count: of.length, sum: of.reduce((a, p) => a + toNum(p.amount), 0) };
    }).filter(r => r.count);

    const summary: Sheet<(typeof byMethod)[number]> = {
      name: 'Resumo por forma',
      rows: byMethod,
      columns: [
        { header: 'Forma', value: r => METHOD_LABEL[r.method], width: 14 },
        { header: 'Pagamentos', value: r => r.count, format: 'int', width: 12, total: true },
        { header: 'Valor', value: r => Math.round(r.sum * 100) / 100, format: 'money', total: true },
      ],
    };
    return { title: 'Financeiro — pagamentos', sheets: [list, summary] };
  }
}
