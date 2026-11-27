import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { EstablishmentScope } from 'src/core/auth/establishment-scope.service';
import { ListUserDto } from '../dto/list-user.dto';
import { UpdateUserDTO } from '../dto/update-user.dto';
import { FrontEndCreateUser } from '../dto/create-user.dto';
import { CreateWorkerDTO } from '../dto/create-worker-dto';
import { assertStaff } from 'src/shared/utils/role.util';
import { canManageRole, UserFactory } from '../factories/user.factory';
import { UserRepository } from '../repositories/user.repository';

/** Casos de uso de usuários. Criação via UserFactory, persistência via UserRepository. */
@Injectable()
export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly factory: UserFactory,
    private readonly scope: EstablishmentScope,
  ) {}

  private tenant(auth: AuthPayload) {
    return { enterpriseId: auth.enterpriseId, establishmentId: auth.establishmentId, requesterRole: auth.role };
  }

  // cadastrar em outro estabelecimento exige ser da equipe de lá, e vale o papel que a pessoa tem lá
  async createClient(auth: AuthPayload, { establishmentId, ...dto }: FrontEndCreateUser) {
    const scoped = await this.scope.resolve(auth, establishmentId);
    return this.users.createOrLink(await this.factory.createClient(dto, this.tenant(scoped)));
  }

  async createStaff(auth: AuthPayload, dto: CreateWorkerDTO) {
    return this.users.createOrLink(await this.factory.createStaff(dto.role ?? Role.WORKER, dto, this.tenant(auth)));
  }

  search(auth: AuthPayload, term: string): Promise<ListUserDto[]> {
    return this.users.search(auth.establishmentId, term.trim(), 10);
  }

  async getById(id: number, establishmentId: number) {
    const user = await this.users.findInEstablishment(id, establishmentId);
    if (!user) throw new NotFoundException('Usuário não encontrado neste estabelecimento.');
    return user;
  }

  /** ficha de uma pessoa: ela mesma, ou a equipe do estabelecimento escolhido (com o papel de lá) */
  async view(auth: AuthPayload, id: number, establishmentId?: number) {
    const scoped = await this.scopeFor(auth, id, establishmentId);
    return this.getById(id, scoped.establishmentId);
  }

  async update(sessionAuth: AuthPayload, id: number, data: UpdateUserDTO, establishmentId?: number) {
    const auth = await this.scopeFor(sessionAuth, id, establishmentId);
    if (data.active !== undefined) await this.assertCanToggleActive(auth, id);
    const updated = await this.users.update(id, auth.establishmentId, data);
    if (!updated) throw new NotFoundException('Usuário não encontrado neste estabelecimento.');
    return this.getById(id, auth.establishmentId);
  }

  private async scopeFor(auth: AuthPayload, id: number, establishmentId?: number) {
    if (auth.sub === id && !establishmentId) return auth;
    const scoped = await this.scope.resolve(auth, establishmentId);
    if (auth.sub !== id) assertStaff(scoped.role);
    return scoped;
  }

  /** ativar/desativar segue a mesma política de quem pode cadastrar aquele papel */
  private async assertCanToggleActive(auth: AuthPayload, id: number) {
    if (auth.sub === id) throw new BadRequestException('Você não pode ativar/desativar o próprio usuário.');
    const target = await this.users.membership(id, auth.establishmentId);
    if (!target) throw new NotFoundException('Usuário não encontrado neste estabelecimento.');
    if (!canManageRole(target.role, auth.role)) {
      throw new ForbiddenException('Seu perfil não tem permissão para ativar/desativar este usuário.');
    }
  }
}
