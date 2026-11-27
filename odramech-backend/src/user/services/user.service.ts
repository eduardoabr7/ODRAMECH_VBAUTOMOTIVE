import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { ListUserDto } from '../dto/list-user.dto';
import { UpdateUserDTO } from '../dto/update-user.dto';
import { FrontEndCreateUser } from '../dto/create-user.dto';
import { CreateWorkerDTO } from '../dto/create-worker-dto';
import { UserFactory } from '../factories/user.factory';
import { UserRepository } from '../repositories/user.repository';

/** Casos de uso de usuários. Criação via UserFactory, persistência via UserRepository. */
@Injectable()
export class UserService {
  constructor(private readonly users: UserRepository, private readonly factory: UserFactory) {}

  private tenant(auth: AuthPayload) {
    return { enterpriseId: auth.enterpriseId, establishmentId: auth.establishmentId, requesterRole: auth.role };
  }

  async createClient(auth: AuthPayload, dto: FrontEndCreateUser) {
    return this.users.create(await this.factory.createClient(dto, this.tenant(auth)));
  }

  async createStaff(auth: AuthPayload, dto: CreateWorkerDTO) {
    return this.users.create(await this.factory.createStaff(dto.role ?? Role.WORKER, dto, this.tenant(auth)));
  }

  search(auth: AuthPayload, term: string): Promise<ListUserDto[]> {
    return this.users.search(auth.establishmentId, term.trim(), 10);
  }

  async getById(id: number, establishmentId: number) {
    const user = await this.users.findInEstablishment(id, establishmentId);
    if (!user) throw new NotFoundException('Usuário não encontrado neste estabelecimento.');
    return user;
  }

  async update(id: number, establishmentId: number, data: UpdateUserDTO) {
    const updated = await this.users.update(id, establishmentId, data);
    if (!updated) throw new NotFoundException('Usuário não encontrado neste estabelecimento.');
    return this.getById(id, establishmentId);
  }
}
