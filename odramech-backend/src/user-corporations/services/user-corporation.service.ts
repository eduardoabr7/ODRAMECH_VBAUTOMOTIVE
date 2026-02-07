import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";
import { createUserCorporationDTO } from "../dto/create-user-corporation.dto";
import { Role } from "@prisma/client";

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


    //testar melhor essa função ============================================
    async getEstablishments(enterpriseLoggedId: number, idUserAdmin, role: Role) {
      const establishmentsAdmin = await this._prismaService.userCorporation.findMany({
        where: {
          idEnterprise: enterpriseLoggedId,
          idUser: idUserAdmin,
          role: role
        },
        select: {
          establishment: {
            select: {
              name: true,
              id: true
            }
          }
        }
      })
    
      return establishmentsAdmin
    }
    // ====================================================================

    async getUsersByEstablishment(estabId) {
      const users = await this._prismaService.userCorporation.findMany({
        where: {
          idEstablishment: estabId,
        },
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              principalPhone: true
            }
          },
          role: true
        }
      })

      return users
    }
}