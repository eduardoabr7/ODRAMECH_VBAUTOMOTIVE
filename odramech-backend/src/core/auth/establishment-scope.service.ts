import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { PrismaService } from 'src/core/database/prisma.service';
import { STAFF_ROLES } from 'src/shared/utils/role.util';

/** `?establishmentId=` opcional das telas que deixam escolher o estabelecimento (ex.: lista de clientes). */
export class EstablishmentScopeQueryDTO {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  establishmentId?: number;
}

/**
 * Troca o estabelecimento de uma sessão só para uma consulta.
 *
 * Quem é da equipe de vários estabelecimentos vê os dados de todos sem trocar de login,
 * mas com o papel que tem LÁ (admin num, mecânico noutro). Cliente nunca troca.
 */
@Injectable()
export class EstablishmentScope {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(auth: AuthPayload, establishmentId?: number | null): Promise<AuthPayload> {
    if (!establishmentId || establishmentId === auth.establishmentId) return auth;

    const membership = await this.prisma.userCorporation.findFirst({
      where: { idUser: auth.sub, idEstablishment: establishmentId, active: true, role: { in: STAFF_ROLES as Role[] } },
      select: { role: true, idEnterprise: true },
    });
    if (!membership) throw new ForbiddenException('Você não faz parte da equipe deste estabelecimento.');

    return { ...auth, establishmentId, enterpriseId: membership.idEnterprise, role: membership.role };
  }
}
