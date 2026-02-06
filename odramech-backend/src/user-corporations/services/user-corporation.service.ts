import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";
import { createUserCorporationDTO } from "../dto/create-user-corporation.dto";

@Injectable()
export class UserCorporationService {

    constructor(
        private readonly _prismaService: PrismaService
    ){}


    async createUserCorporation(dataReceived: createUserCorporationDTO) {
        return this._prismaService.userCorporation.create({ data: dataReceived })
    }

    // to check if the user and the establishment are related.
    async validateRelationUserToEstablishment(uId: number, estId: number) {
      return await this._prismaService.userCorporation.findFirst({
        where: { 
          idUser: uId,
          idEstablishment: estId 
        }
      })
    }

    async getUserCorporationsByUserId(userId: number) {
      const userCorporations = await this._prismaService.userCorporation.findMany({
        where: { idUser: userId },
        include: {
          establishment: {
            select: {
              id: true,
              logoUrl: true,
              name: true,
              address: {
                select: {
                  street: true,
                  number: true,
                  city: true
                }
              }
            }
          },
          enterprise: {
            select: {
              id: true,
              logoUrl: true,
              name: true,
            }
          }
        },
      });

      const grouped = userCorporations.reduce((acc, curr) => {
        const enterpriseId = curr.idEnterprise;

        if (!acc[enterpriseId]) {
          acc[enterpriseId] = {
            ...curr.enterprise,
            establishments: []
          };
        }

        acc[enterpriseId].establishments.push({
          ...curr.establishment,
          role: curr.role
        });

        return acc;
      }, {});

      return Object.values(grouped);
    }


    async getUserCorporationByEstablishmentId(estabId: number, userId: number) {
      const userCorporation =
        await this._prismaService.userCorporation.findFirst({
          where: { 
            idEstablishment: estabId, 
            idUser: userId 
          },
          include: {
            establishment: {
              select: {
                id: true,
                logoUrl: true,
                name: true,
                address: {
                  select: {
                    street: true,
                    number: true,
                    city: true,
                  },
                },
              },
            },
            enterprise: {
              select: {
                id: true,
                logoUrl: true,
                name: true,
              },
            },
          },
        });
      
      if (!userCorporation) return null;
      
      return {
        ...userCorporation.enterprise,
        establishment: {
          ...userCorporation.establishment,
          role: userCorporation.role,
        },
      };
    } 

}