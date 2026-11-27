import { Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma-service";
import { EnterpriseWithEstablishmentDTO } from "../dto/enterprise-with-establishment.dto";
import { EstablishmentListCommonDTO } from "src/establishment/dto/establishment-list-common.dto";

@Injectable()
export class EnterpriseService {

    constructor(
        private readonly _prisma : PrismaService
    ){}

    async userBelongsTo(userId: number, enterpriseId: number): Promise<boolean> {
        const link = await this._prisma.userCorporation.findFirst({
            where: { idUser: userId, idEnterprise: enterpriseId, active: true },
            select: { idUser: true },
        });
        return !!link;
    }

    async getAll(){
        return await this._prisma.enterprise.findMany();
    }

    async getAllEstablishmentsFromEnterprise(idEnterprise: number): Promise<EstablishmentListCommonDTO[]>{
        const establishments = await this._prisma.establishment.findMany({
            where: {
                enterpriseId: idEnterprise
            },
            select: {
                id: true,
                logoUrl: true,
                name: true,
                address: true
            }
        });

        return establishments;
    }

    async createEnterpriseWithEstablishment(dataReceived: EnterpriseWithEstablishmentDTO, creatorUserId: number) {
      const { enterprise, establishment } = dataReceived;

      // tudo numa transação: empresa, estabelecimento e o criador como ADMIN (antes o front fazia
      // o vínculo numa segunda chamada aberta — POST /usercorp — que aceitava qualquer papel/id)
      return this._prisma.$transaction(async (tx) => {
      const enterpriseCreated = await tx.enterprise.create({
        data: {
            name: enterprise.name,
            email: enterprise.email,
            phone: enterprise.phone,
            cnpj: enterprise.cnpj,
            address: {
                create: {
                    street: enterprise.address.street,
                    number: enterprise.address.number,
                    complement: enterprise.address.complement,
                    district: enterprise.address.district,
                    city: enterprise.address.city,
                    zipCode: enterprise.address.zipCode,
                    country: enterprise.address.country,
                    neighborhood: enterprise.address.neighborhood
                }
            }
        }
      })

      const establishmentCreated = await tx.establishment.create({
        data: {
          name: establishment.name,
          email: establishment.email,
          phone: establishment.phone,
          cnpj: establishment.cnpj,
          enterprise: {
            connect: { id: enterpriseCreated.id },
          },
          counter: { create: {} },
          address: {
            create: {
              street: establishment.address.street,
              number: establishment.address.number,
              complement: establishment.address.complement,
              district: establishment.address.district,
              city: establishment.address.city,
              zipCode: establishment.address.zipCode,
              country: establishment.address.country,
              neighborhood: establishment.address.neighborhood,
            },
          },
        },
      });

      await tx.userCorporation.create({
        data: { idUser: creatorUserId, idEnterprise: enterpriseCreated.id, idEstablishment: establishmentCreated.id, role: Role.ADMIN },
      });

      return { idEtp: enterpriseCreated.id, idEst: establishmentCreated.id }
      });
    }
}