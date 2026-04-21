import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";
import { CreateUserDto } from "../dto/create-user.dto";
import * as bcrypt from "bcrypt";
import { ListUserDto } from "../dto/list-user.dto";
import { CreateWorkerDTO } from "../dto/create-worker-dto";
import { Role } from "@prisma/client";

@Injectable()
export class UserService {
    constructor(
        private readonly _prismaService: PrismaService
    ){}

    async hashPassword(password: string): Promise<string> {
      return bcrypt.hash(password, 12);
    }
    
    async create(data: CreateUserDto) {
      let passwordHash: string | undefined = undefined;

      if (data.password) {
        passwordHash = await this.hashPassword(data.password);
      }

      return this._prismaService.user.create({
        data: {
          name: data.name,
          gender: data.gender,
          email: data.email ?? undefined,
          password: passwordHash,
          principalPhone: data.principalPhone,
          secondaryPhone: data.secondaryPhone,
        
          address: data.address ? {
            create: {
              street: data.address.street,
              number: data.address.number,
              district: data.address.district,
              neighborhood: data.address.neighborhood,
              city: data.address.city,
              zipCode: data.address.zipCode,
              country: data.address.country,
              complement: data.address.complement ?? undefined
            }
          } : undefined,

          userCorporation: {
            create: {
                idEnterprise: data.enterpriseId,
                idEstablishment: data.establishmentId,
                role: "USER"
            }
          }
        }
      });
    }

    async createWorker(data) {

      const requesterRole = data.role;
      const targetRole = data.dataReceived.role;

      if (requesterRole === Role.USER) {
        throw new ForbiddenException('Seu perfil não tem permissão para cadastrar colaboradores.');
      }

      if (targetRole === Role.ADMIN) {
        if (requesterRole !== Role.ADMIN && requesterRole !== Role.SUPERUSER) {
          throw new ForbiddenException('Apenas administradores e super usuários podem criar perfis de nível administrativo.');
        }
      }

      let passwordHash: string | undefined = undefined;

      if (data.dataReceived.password) {
        passwordHash = await this.hashPassword(data.dataReceived.password);
      }

      return this._prismaService.user.create({
        data: {
          name: data.dataReceived.name,
          gender: data.dataReceived.gender,
          email: data.dataReceived.email ?? undefined,
          password: passwordHash,
          principalPhone: data.dataReceived.principalPhone,
          secondaryPhone: data.dataReceived.secondaryPhone,
        
          address: data.dataReceived.address ? {
            create: {
              street: data.dataReceived.address.street,
              number: data.dataReceived.address.number,
              district: data.dataReceived.address.district,
              neighborhood: data.dataReceived.address.neighborhood,
              city: data.dataReceived.address.city,
              zipCode: data.dataReceived.address.zipCode,
              country: data.dataReceived.address.country,
              complement: data.dataReceived.address.complement ?? undefined
            }
          } : undefined,

          userCorporation: {
            create: {
                idEnterprise: data.enterpriseId,
                idEstablishment: data.establishmentId,
                role: data.dataReceived.role
            }
          }
        }
      });
    }

    async search(q: string): Promise<ListUserDto[]> {
      return this._prismaService.user.findMany({
        where: {
          OR: [
            { name:  { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { principalPhone: { contains: q } },
          ],
        },
        take: 10,
        select: { id: true, name: true, principalPhone: true, email: true },
      });
    }
}