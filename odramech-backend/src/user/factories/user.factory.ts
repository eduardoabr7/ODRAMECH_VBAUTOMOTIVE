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
}

export interface TenantContext {
  enterpriseId: number;
  establishmentId: number;
  /** papel de quem está criando */
  requesterRole: Role;
}

/** Quem pode criar cada tipo de usuário. */
const CREATION_POLICY: Record<Role, Role[]> = {
  [Role.USER]: [Role.ADMIN, Role.WORKER, Role.SUPERUSER],
  [Role.WORKER]: [Role.ADMIN, Role.SUPERUSER, Role.WORKER],
  [Role.ADMIN]: [Role.ADMIN, Role.SUPERUSER],
  [Role.SUPERUSER]: [Role.SUPERUSER],
};

/**
 * FACTORY — cria os diferentes tipos de usuário (cliente, mecânico, administrador)
 * a partir da mesma entrada, aplicando:
 *   - a política de quem pode criar quem;
 *   - hash de senha;
 *   - normalização (e-mail minúsculo, telefones só com dígitos);
 *   - o vínculo com empresa/estabelecimento no papel correto.
 *
 * Antes havia dois métodos quase idênticos no UserService; agora um novo papel é
 * uma linha na política, não um método novo.
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

  private async build(role: Role, input: NewUserInput, ctx: TenantContext): Promise<Prisma.UserCreateInput> {
    if (!CREATION_POLICY[role].includes(ctx.requesterRole)) {
      throw new ForbiddenException(
        role === Role.ADMIN
          ? 'Apenas administradores e super usuários podem criar perfis de nível administrativo.'
          : 'Seu perfil não tem permissão para cadastrar este tipo de usuário.',
      );
    }

    const email = input.email?.trim().toLowerCase() || undefined;
    const password = input.password ? await this.bcrypt.hashPassword(input.password) : undefined;

    return {
      name: input.name.trim().replace(/\s+/g, ' '),
      gender: input.gender,
      email,
      password,
      principalPhone: onlyDigits(input.principalPhone),
      secondaryPhone: input.secondaryPhone ? onlyDigits(input.secondaryPhone) : undefined,
      address: input.address
        ? { create: { ...input.address, complement: input.address.complement ?? undefined } }
        : undefined,
      userCorporation: {
        create: {
          role,
          enterprise: { connect: { id: ctx.enterpriseId } },
          establishment: { connect: { id: ctx.establishmentId } },
        },
      },
    };
  }
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, '');
}
