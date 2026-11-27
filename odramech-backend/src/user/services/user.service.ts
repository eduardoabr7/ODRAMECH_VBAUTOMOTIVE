import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { ListUserDto } from '../dto/list-user.dto';
import { UpdateUserDTO } from '../dto/update-user.dto';
import { FrontEndCreateUser } from '../dto/create-user.dto';
import { CreateWorkerDTO } from '../dto/create-worker-dto';
import { canManageRole, UserFactory } from '../factories/user.factory';
import { UserRepository } from '../repositories/user.repository';

/** Casos de uso de usuários. Criação via UserFactory, persistência via UserRepository. */
@Injectable()
export class UserService {
  constructor(private readonly users: UserRepository, private readonly factory: UserFactory) {}

  private tenant(auth: AuthPayload) {
    return { enterpriseId: auth.enterpriseId, establishmentId: auth.establishmentId, requesterRole: auth.role };
  }

  async createClient(auth: AuthPayload, { establishmentId, ...dto }: FrontEndCreateUser) {
    return this.users.createOrLink(await this.factory.createClient(dto, await this.targetTenant(auth, establishmentId)));
  }

  // cadastrar em outro estabelecimento exige ser da equipe de lá, e vale o papel que a pessoa tem lá
  private async targetTenant(auth: AuthPayload, establishmentId?: number) {
    if (!establishmentId || establishmentId === auth.establishmentId) return this.tenant(auth);
    const m = await this.users.staffMembership(auth.sub, establishmentId);
    if (!m) throw new ForbiddenException('Você não faz parte da equipe deste estabelecimento.');
    return { enterpriseId: m.enterpriseId, establishmentId, requesterRole: m.role };
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

  async update(auth: AuthPayload, id: number, data: UpdateUserDTO) {
    if (data.active !== undefined) await this.assertCanToggleActive(auth, id);
    const updated = await this.users.update(id, auth.establishmentId, data);
    if (!updated) throw new NotFoundException('Usuário não encontrado neste estabelecimento.');
    return this.getById(id, auth.establishmentId);
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
