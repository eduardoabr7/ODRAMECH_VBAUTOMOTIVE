import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";
import { CreateUserDto } from "../dto/create-user.dto";
import * as bcrypt from "bcrypt";

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
}