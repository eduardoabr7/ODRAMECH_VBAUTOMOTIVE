import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';
import { UpdateUserDTO } from '../dto/update-user.dto';

const PUBLIC_USER = { id: true, name: true, email: true, principalPhone: true, gender: true } as const;

/** REPOSITORY (porta) de usuários. */
export abstract class UserRepository {
  abstract create(data: Prisma.UserCreateInput): Promise<{ id: number; name: string; email: string | null; principalPhone: string }>;
  abstract search(establishmentId: number, term: string, take: number): Promise<any[]>;
  abstract findInEstablishment(id: number, establishmentId: number): Promise<any | null>;
  abstract update(id: number, establishmentId: number, data: UpdateUserDTO): Promise<boolean>;
}

/** REPOSITORY (Prisma). Converte violação de unicidade em erro de negócio legível. */
@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) { super(); }

  async create(data: Prisma.UserCreateInput) {
    try {
      return await this.prisma.user.create({ data, select: PUBLIC_USER });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('Já existe um usuário com este e-mail.');
      throw e;
    }
  }

  search(establishmentId: number, term: string, take: number) {
    const digits = term.replace(/\D/g, '');
    return this.prisma.user.findMany({
      where: {
        userCorporation: { some: { idEstablishment: establishmentId } },
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { principalPhone: { contains: digits || term } },
        ],
      },
      take,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, principalPhone: true, email: true },
    });
  }

  async findInEstablishment(id: number, establishmentId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id, userCorporation: { some: { idEstablishment: establishmentId } } },
      select: {
        id: true, name: true, gender: true, email: true, principalPhone: true, secondaryPhone: true, createdAt: true,
        address: true,
        userCorporation: { where: { idEstablishment: establishmentId }, select: { role: true } },
        vehicles: { include: { vehicle: true } },
        _count: { select: { workOrdersAsClient: { where: { establishmentId } } } },
      },
    });
    if (!user) return null;
    const { userCorporation, vehicles, _count, ...rest } = user;
    return {
      ...rest,
      role: userCorporation[0]?.role ?? null,
      vehicles: vehicles.map(v => v.vehicle),
      workOrdersCount: _count.workOrdersAsClient,
    };
  }

  async update(id: number, establishmentId: number, data: UpdateUserDTO): Promise<boolean> {
    const current = await this.prisma.user.findFirst({
      where: { id, userCorporation: { some: { idEstablishment: establishmentId } } },
      select: { addressId: true },
    });
    if (!current) return false;

    const { address, ...fields } = data;
    try {
      await this.prisma.user.update({
        where: { id },
        data: {
          ...fields,
          email: fields.email === '' ? null : fields.email?.toLowerCase(),
          ...(address && {
            address: current.addressId
              ? { update: { ...address, complement: address.complement ?? null } }
              : { create: { ...address, complement: address.complement ?? undefined } },
          }),
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('Já existe um usuário com este e-mail.');
      throw e;
    }
    return true;
  }
}
