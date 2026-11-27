import { Injectable } from '@nestjs/common';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { PrismaService } from 'src/core/database/prisma.service';
import { isStaff } from 'src/shared/utils/role.util';
import { ExportQueryDTO } from '../dto/export-query.dto';
import { ExportSource, MAX_EXPORT_ROWS, Sheet, Workbook } from '../domain/spreadsheet';

/** Veículos dos clientes do estabelecimento (cliente: só os dele). */
@Injectable()
export class VehiclesExportSource extends ExportSource {
  readonly kind = 'vehicles';
  readonly fileName = 'veiculos';
  readonly staffOnly = false;

  constructor(private readonly prisma: PrismaService) { super(); }

  async build(auth: AuthPayload, q: ExportQueryDTO): Promise<Workbook> {
    const term = q.search?.trim();
    const plate = term?.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const establishmentId = auth.establishmentId;

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        users: { some: { user: { userCorporation: { some: { idEstablishment: establishmentId } }, ...(isStaff(auth.role) ? {} : { id: auth.sub }) } } },
        ...(term && {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { make: { contains: term, mode: 'insensitive' } },
            ...(plate ? [{ plate: { contains: plate } }] : []),
            { users: { some: { user: { name: { contains: term, mode: 'insensitive' } } } } },
          ],
        }),
      },
      include: {
        users: { select: { user: { select: { name: true, principalPhone: true } } } },
        workOrders: { where: { establishmentId }, select: { dateTimeCreation: true }, orderBy: { dateTimeCreation: 'desc' } },
      },
      orderBy: { plate: 'asc' },
      take: MAX_EXPORT_ROWS,
    });

    const sheet: Sheet<(typeof vehicles)[number]> = {
      name: 'Veículos',
      rows: vehicles,
      columns: [
        { header: 'Placa', value: v => v.plate, width: 10 },
        { header: 'Marca', value: v => v.make, width: 16 },
        { header: 'Modelo', value: v => v.name, width: 22 },
        { header: 'Ano fab.', value: v => v.manufactureYear, format: 'int', width: 9 },
        { header: 'Ano mod.', value: v => v.modelYear, format: 'int', width: 9 },
        { header: 'Cor', value: v => v.color, width: 12 },
        { header: 'Km', value: v => v.km, width: 10 },
        { header: 'Proprietário(s)', value: v => v.users.map(u => u.user.name).join(', '), width: 30 },
        { header: 'Telefone', value: v => v.users[0]?.user.principalPhone, width: 16 },
        { header: 'Nº de OS', value: v => v.workOrders.length, format: 'int', width: 9, total: true },
        { header: 'Última OS', value: v => v.workOrders[0]?.dateTimeCreation, format: 'date' },
      ],
    };
    return { title: 'Veículos', sheets: [sheet] };
  }
}
