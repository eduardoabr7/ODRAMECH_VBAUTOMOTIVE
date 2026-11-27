import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { itemTotal, summarizeMoney, toNum } from 'src/shared/utils/money.util';
import { WorkOrderCriteriaBuilder } from 'src/work-order/domain/work-order-criteria';
import { STATUS_LABEL } from 'src/work-order/domain/work-order-status';
import { WorkOrderRepository } from 'src/work-order/repositories/work-order.repository';
import { ExportQueryDTO, periodOf } from '../dto/export-query.dto';
import { ExportSource, MAX_EXPORT_ROWS, Sheet, Workbook } from '../domain/spreadsheet';

const KIND_LABEL = { PECA: 'Peça', SERVICO: 'Serviço' } as const;

/** Ordens de serviço (aba geral) + peças e serviços de cada OS (segunda aba). */
@Injectable()
export class WorkOrdersExportSource extends ExportSource {
  readonly kind = 'work-orders';
  readonly fileName = 'ordens-de-servico';
  // cliente exporta as próprias OS (o critério já filtra)
  readonly staffOnly = false;

  constructor(private readonly repo: WorkOrderRepository) { super(); }

  async build(auth: AuthPayload, q: ExportQueryDTO): Promise<Workbook> {
    const period = periodOf(q);
    const criteria = WorkOrderCriteriaBuilder.for(auth)
      .withStatus(q.status as OrderStatus | undefined)
      .matching(q.search)
      .createdBetween(period?.gte, period?.lte)
      .build();
    const rows = (await this.repo.findForExport(criteria, MAX_EXPORT_ROWS)).map(wo => ({ ...wo, money: summarizeMoney(wo.items, wo.payments) }));

    const orders: Sheet<(typeof rows)[number]> = {
      name: 'Ordens de serviço',
      rows,
      columns: [
        { header: 'Nº OS', value: r => r.numberOs, format: 'int', width: 8 },
        { header: 'Status', value: r => STATUS_LABEL[r.status as OrderStatus] ?? r.status, width: 18 },
        { header: 'Abertura', value: r => r.dateTimeCreation, format: 'datetime' },
        { header: 'Encerramento', value: r => r.dateTimeEnd, format: 'datetime' },
        { header: 'Cliente', value: r => r.client?.name, width: 28 },
        { header: 'Telefone', value: r => r.client?.principalPhone, width: 16 },
        { header: 'E-mail', value: r => r.client?.email, width: 28 },
        { header: 'Veículo', value: r => [r.vehicle?.make, r.vehicle?.name].filter(Boolean).join(' '), width: 24 },
        { header: 'Placa', value: r => r.vehicle?.plate, width: 10 },
        { header: 'Km', value: r => r.vehicle?.km, width: 10 },
        { header: 'Responsável', value: r => r.userResponsible?.name },
        { header: 'Aberta por', value: r => r.userCreation?.name },
        { header: 'Total', value: r => r.money.total, format: 'money', total: true },
        { header: 'Pago', value: r => r.money.paid, format: 'money', total: true },
        { header: 'Saldo', value: r => r.money.balance, format: 'money', total: true },
      ],
    };

    const items = rows.flatMap(wo => wo.items.map((i: any) => ({ wo, i })));
    const itemsSheet: Sheet<(typeof items)[number]> = {
      name: 'Peças e serviços',
      rows: items,
      columns: [
        { header: 'Nº OS', value: r => r.wo.numberOs, format: 'int', width: 8 },
        { header: 'Cliente', value: r => r.wo.client?.name, width: 28 },
        { header: 'Tipo', value: r => KIND_LABEL[r.i.kind as keyof typeof KIND_LABEL] ?? r.i.kind, width: 10 },
        { header: 'Descrição', value: r => r.i.description, width: 40 },
        { header: 'Qtd.', value: r => toNum(r.i.quantity), format: 'decimal', width: 8 },
        { header: 'Valor unit.', value: r => toNum(r.i.unitPrice), format: 'money' },
        { header: 'Desconto', value: r => toNum(r.i.discount), format: 'money', total: true },
        { header: 'Total', value: r => itemTotal(r.i), format: 'money', total: true },
      ],
    };

    return { title: 'Ordens de serviço', sheets: [orders, itemsSheet] };
  }
}
