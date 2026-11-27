import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { PrismaService } from 'src/core/database/prisma.service';
import { ExportQueryDTO } from '../dto/export-query.dto';
import { ExportSource, MAX_EXPORT_ROWS, Sheet, Workbook } from '../domain/spreadsheet';

const GENDER = { M: 'Masculino', F: 'Feminino', O: 'Outro' } as const;

/** Clientes do estabelecimento, com contato, endereço, veículos e nº de OS. */
@Injectable()
export class ClientsExportSource extends ExportSource {
  readonly kind = 'clients';
  readonly fileName = 'clientes';
  readonly staffOnly = true;

  constructor(private readonly prisma: PrismaService) { super(); }

  async build(auth: AuthPayload, q: ExportQueryDTO): Promise<Workbook> {
    const term = q.search?.trim();
    const digits = term?.replace(/\D/g, '');
    const establishmentId = auth.establishmentId;

    const links = await this.prisma.userCorporation.findMany({
      where: {
        idEstablishment: establishmentId,
        role: Role.USER,
        ...(term && {
          user: {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { email: { contains: term, mode: 'insensitive' } },
              ...(digits ? [{ principalPhone: { contains: digits } }] : []),
            ],
          },
        }),
      },
      select: {
        active: true,
        user: {
          select: {
            name: true, gender: true, email: true, principalPhone: true, secondaryPhone: true, createdAt: true, address: true,
            vehicles: { select: { vehicle: { select: { plate: true } } } },
            _count: { select: { workOrdersAsClient: { where: { establishmentId } } } },
          },
        },
      },
      orderBy: { user: { name: 'asc' } },
      take: MAX_EXPORT_ROWS,
    });

    const sheet: Sheet<(typeof links)[number]> = {
      name: 'Clientes',
      rows: links,
      columns: [
        { header: 'Nome', value: r => r.user.name, width: 30 },
        { header: 'Situação', value: r => (r.active ? 'Ativo' : 'Inativo'), width: 10 },
        { header: 'Gênero', value: r => GENDER[r.user.gender], width: 11 },
        { header: 'E-mail', value: r => r.user.email, width: 30 },
        { header: 'Telefone', value: r => r.user.principalPhone, width: 16 },
        { header: 'Telefone 2', value: r => r.user.secondaryPhone, width: 16 },
        { header: 'CEP', value: r => r.user.address?.zipCode, width: 11 },
        { header: 'Endereço', value: r => this.street(r.user.address), width: 36 },
        { header: 'Bairro', value: r => r.user.address?.neighborhood },
        { header: 'Cidade', value: r => r.user.address?.city },
        { header: 'UF', value: r => r.user.address?.district, width: 6 },
        { header: 'Veículos (placas)', value: r => r.user.vehicles.map(v => v.vehicle.plate).join(', '), width: 24 },
        { header: 'Nº de OS', value: r => r.user._count.workOrdersAsClient, format: 'int', width: 9, total: true },
        { header: 'Cliente desde', value: r => r.user.createdAt, format: 'date' },
      ],
    };
    return { title: 'Clientes', sheets: [sheet] };
  }

  private street(a: { street: string; number: string; complement: string | null } | null): string | null {
    if (!a) return null;
    return [`${a.street}, ${a.number}`, a.complement].filter(Boolean).join(' - ');
  }
}
