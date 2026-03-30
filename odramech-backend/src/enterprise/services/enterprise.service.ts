import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";
import { EnterpriseWithEstablishmentDTO } from "../dto/enterprise-with-establishment.dto";
import { EstablishmentListCommonDTO } from "src/establishment/dto/establishment-list-common.dto";

@Injectable()
export class EnterpriseService {

    constructor(
        private readonly _prisma : PrismaService
    ){}

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

    async createEnterpriseWithEstablishment(dataReceived: EnterpriseWithEstablishmentDTO) {
      const { enterprise, establishment } = dataReceived;

      const enterpriseCreated = await this._prisma.enterprise.create({
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

      const establishmentCreated = await this._prisma.establishment.create({
        data: {
          name: establishment.name,
          email: establishment.email,
          phone: establishment.phone,
          cnpj: establishment.cnpj,
          enterprise: {
            connect: { id: enterpriseCreated.id },
          },
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

      return { idEtp: enterpriseCreated.id, idEst: establishmentCreated.id }
    }
}