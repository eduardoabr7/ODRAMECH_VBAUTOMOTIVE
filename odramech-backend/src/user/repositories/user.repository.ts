import { ConflictException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';
import { UpdateUserDTO } from '../dto/update-user.dto';
import { Membership, NewUser } from '../factories/user.factory';

const PUBLIC_USER = { id: true, name: true, email: true, principalPhone: true, gender: true } as const;

export interface CreatedUser {
  id: number;
  name: string;
  email: string | null;
  principalPhone: string;
  /** true = a pessoa já tinha cadastro (outro estabelecimento/empresa) e só foi vinculada */
  linkedExisting: boolean;
}

/** REPOSITORY (porta) de usuários. */
export abstract class UserRepository {
  /** cria a pessoa ou, se o e-mail já existir, vincula a pessoa existente ao estabelecimento */
  abstract createOrLink(data: NewUser): Promise<CreatedUser>;
  abstract search(establishmentId: number, term: string, take: number): Promise<any[]>;
  abstract findInEstablishment(id: number, establishmentId: number): Promise<any | null>;
  abstract membership(id: number, establishmentId: number): Promise<{ role: Role; active: boolean } | null>;
  /** vínculo ativo de equipe (admin/mecânico/super) da pessoa com o estabelecimento */
  abstract staffMembership(id: number, establishmentId: number): Promise<{ role: Role; enterpriseId: number } | null>;
  abstract update(id: number, establishmentId: number, data: UpdateUserDTO): Promise<boolean>;
}

/** REPOSITORY (Prisma). Converte violação de unicidade em erro de negócio legível. */
@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) { super(); }

  async createOrLink({ user, membership }: NewUser): Promise<CreatedUser> {
    const email = typeof user.email === 'string' ? user.email : null;
    const existing = email
      ? await this.prisma.user.findUnique({ where: { email }, select: { ...PUBLIC_USER, password: true } })
      : null;

    if (existing) return this.link(existing, membership, typeof user.password === 'string' ? user.password : undefined);

    try {
      const created = await this.prisma.user.create({
        data: {
          ...user,
          userCorporation: {
            create: {
              role: membership.role,
              active: membership.active,
              enterprise: { connect: { id: membership.enterpriseId } },
              establishment: { connect: { id: membership.establishmentId } },
            },
          },
        },
        select: PUBLIC_USER,
      });
      return { ...created, linkedExisting: false };
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('Já existe um usuário com este e-mail.');
      throw e;
    }
  }

  // vincula quem já tem cadastro sem mexer nos dados nem na senha (só define a senha se não tinha)
  private async link(
    existing: { id: number; name: string; email: string | null; principalPhone: string; password: string | null },
    m: Membership,
    passwordHash?: string,
  ): Promise<CreatedUser> {
    const already = await this.prisma.userCorporation.findUnique({
      where: { idUser_idEnterprise_idEstablishment: { idUser: existing.id, idEnterprise: m.enterpriseId, idEstablishment: m.establishmentId } },
    });
    if (already) throw new ConflictException('Este e-mail já está cadastrado neste estabelecimento.');

    await this.prisma.$transaction([
      this.prisma.userCorporation.create({
        data: { idUser: existing.id, idEnterprise: m.enterpriseId, idEstablishment: m.establishmentId, role: m.role, active: m.active },
      }),
      ...(!existing.password && passwordHash
        ? [this.prisma.user.update({ where: { id: existing.id }, data: { password: passwordHash } })]
        : []),
    ]);

    const { password, ...pub } = existing;
    return { ...pub, linkedExisting: true };
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
        userCorporation: { where: { idEstablishment: establishmentId }, select: { role: true, active: true } },
        vehicles: { include: { vehicle: true } },
        _count: { select: { workOrdersAsClient: { where: { establishmentId } } } },
      },
    });
    if (!user) return null;
    const { userCorporation, vehicles, _count, ...rest } = user;
    return {
      ...rest,
      role: userCorporation[0]?.role ?? null,
      active: userCorporation[0]?.active ?? false,
      vehicles: vehicles.map(v => v.vehicle),
      workOrdersCount: _count.workOrdersAsClient,
    };
  }

  membership(id: number, establishmentId: number) {
    return this.prisma.userCorporation.findFirst({
      where: { idUser: id, idEstablishment: establishmentId },
      select: { role: true, active: true },
    });
  }

  async staffMembership(id: number, establishmentId: number) {
    const m = await this.prisma.userCorporation.findFirst({
      where: { idUser: id, idEstablishment: establishmentId, active: true, role: { in: [Role.ADMIN, Role.WORKER, Role.SUPERUSER] } },
      select: { role: true, idEnterprise: true },
    });
    return m ? { role: m.role, enterpriseId: m.idEnterprise } : null;
  }

  async update(id: number, establishmentId: number, data: UpdateUserDTO): Promise<boolean> {
    const current = await this.prisma.user.findFirst({
      where: { id, userCorporation: { some: { idEstablishment: establishmentId } } },
      select: { addressId: true },
    });
    if (!current) return false;

    const { address, active, ...fields } = data;
    try {
      await this.prisma.$transaction([
        this.prisma.user.update({
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
        }),
        // "ativo" é por estabelecimento: desativar aqui não afeta os outros vínculos da pessoa
        ...(active !== undefined
          ? [this.prisma.userCorporation.updateMany({ where: { idUser: id, idEstablishment: establishmentId }, data: { active } })]
          : []),
      ]);
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('Já existe um usuário com este e-mail.');
      throw e;
    }
    return true;
  }
}
