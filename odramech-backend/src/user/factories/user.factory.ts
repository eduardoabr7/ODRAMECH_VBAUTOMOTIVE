import { ForbiddenException, Injectable } from '@nestjs/common';
import { Gender, Prisma, Role } from '@prisma/client';
import { BcryptService } from 'src/crypto/bcrypt.service';
import { AddressDTO } from 'src/address/dto/address.dto';

export interface NewUserInput {
  name: string;
  gender: Gender;
  email?: string | null;
  password?: string | null;
  principalPhone: string;
  secondaryPhone?: string | null;
  address?: AddressDTO | null;
  active?: boolean;
}

export interface TenantContext {
  enterpriseId: number;
  establishmentId: number;
  /** papel de quem está criando */
  requesterRole: Role;
}

/** Vínculo do usuário com um estabelecimento (cad_user_corporation). */
export interface Membership {
  role: Role;
  enterpriseId: number;
  establishmentId: number;
  active: boolean;
}

/** Resultado da fábrica: dados da pessoa (globais) + vínculo com o estabelecimento. */
export interface NewUser {
  user: Omit<Prisma.UserCreateInput, 'userCorporation'>;
  membership: Membership;
}

/** Quem pode criar cada tipo de usuário. */
const CREATION_POLICY: Record<Role, Role[]> = {
  [Role.USER]: [Role.ADMIN, Role.WORKER, Role.SUPERUSER],
  [Role.WORKER]: [Role.ADMIN, Role.SUPERUSER, Role.WORKER],
  [Role.ADMIN]: [Role.ADMIN, Role.SUPERUSER],
  [Role.SUPERUSER]: [Role.SUPERUSER],
};

/** Quem pode criar um usuário com este papel (também vale para ativar/desativar). */
export function canManageRole(target: Role, requester: Role): boolean {
  return CREATION_POLICY[target].includes(requester);
}

/**
 * FACTORY — cria os diferentes tipos de usuário (cliente, mecânico, administrador)
 * a partir da mesma entrada, aplicando:
 *   - a política de quem pode criar quem;
 *   - hash de senha;
 *   - normalização (e-mail minúsculo, telefones só com dígitos);
 *   - o vínculo com empresa/estabelecimento no papel correto.
 *
 * A pessoa (cad_user) é global: o mesmo e-mail pode ser cliente de várias oficinas, por isso
 * os dados dela ficam separados do vínculo.
 */
@Injectable()
export class UserFactory {
  constructor(private readonly bcrypt: BcryptService) {}

  createClient(input: NewUserInput, ctx: TenantContext) {
    return this.build(Role.USER, input, ctx);
  }

  createStaff(role: Role, input: NewUserInput, ctx: TenantContext) {
    return this.build(role === Role.USER ? Role.WORKER : role, input, ctx);
  }

  private async build(role: Role, input: NewUserInput, ctx: TenantContext): Promise<NewUser> {
    if (!canManageRole(role, ctx.requesterRole)) {
      throw new ForbiddenException(
        role === Role.ADMIN
          ? 'Apenas administradores e super usuários podem criar perfis de nível administrativo.'
          : 'Seu perfil não tem permissão para cadastrar este tipo de usuário.',
      );
    }

    const email = input.email?.trim().toLowerCase() || undefined;
    const password = input.password ? await this.bcrypt.hashPassword(input.password) : undefined;

    return {
      user: {
        name: input.name.trim().replace(/\s+/g, ' '),
        gender: input.gender,
        email,
        password,
        // quem definiu a senha foi a oficina: a pessoa troca no primeiro acesso
        mustChangePassword: !!password,
        principalPhone: onlyDigits(input.principalPhone),
        secondaryPhone: input.secondaryPhone ? onlyDigits(input.secondaryPhone) : undefined,
        address: input.address
          ? { create: { ...input.address, complement: input.address.complement ?? undefined } }
          : undefined,
      },
      membership: {
        role,
        enterpriseId: ctx.enterpriseId,
        establishmentId: ctx.establishmentId,
        active: input.active ?? true,
      },
    };
  }
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, '');
}
