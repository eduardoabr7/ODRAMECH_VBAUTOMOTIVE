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
          idEstablishment: estId,
          active: true,
        }
      })
    }

    async getUserCorporationsByUserId(userId: number) {
      const userCorporations = await this._prismaService.userCorporation.findMany({
        where: { idUser: userId, active: true },
        include: {
          establishment: {
            select: {
              id: true,
              logoUrl: true,
              name: true,
              phone: true,
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
              phone: true,
              // logo e nome do tema têm prioridade
              branding: { select: { logoUrl: true, displayName: true } },
            }
          }
        },
        orderBy: [{ idEnterprise: 'asc' }, { idEstablishment: 'asc' }],
      });

      const grouped = userCorporations.reduce((acc, curr) => {
        const enterpriseId = curr.idEnterprise;

        if (!acc[enterpriseId]) {
          const { branding, ...enterprise } = curr.enterprise;
          acc[enterpriseId] = {
            ...enterprise,
            logoUrl: branding?.logoUrl || enterprise.logoUrl,
            displayName: branding?.displayName || null,
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

    async getEstablishmentsOnAdminOrWorker(enterpriseLoggedId: number, userId: number) {
      const relations = await this._prismaService.userCorporation.findMany({
        where: {
          idEnterprise: enterpriseLoggedId,
          idUser: userId,
          active: true,
          role: {
            in: [Role.ADMIN, Role.WORKER]
          }
        },
        include: {
          establishment: {
            include: {
              address: true
            }
          }
        }
      })
    
      const establishments = relations.map((relation) => {
        const { establishment } = relation
      
        return {
          id: establishment.id,
          name: establishment.name,
          logoUrl: establishment.logoUrl,
          address: establishment.address,
          email: establishment.email,
          phone: establishment.phone,
          cnpj: establishment.cnpj,
          role: relation.role
        }
      })
    
      return establishments
    }   

    //testar melhor essa função ============================================
    async getEstablishments(enterpriseLoggedId: number, userId: number) {
      const relations = await this._prismaService.userCorporation.findMany({
        where: {
          idEnterprise: enterpriseLoggedId,
          idUser: userId,
          active: true,
        },
        include: {
          establishment: {
            include: {
              address: true
            }
          }
        }
      })
    
      const establishments = relations.map((relation) => {
        const { establishment, role } = relation
      
        // any users
        const baseData = {
          id: establishment.id,
          name: establishment.name,
          logoUrl: establishment.logoUrl,
          address: establishment.address,
          email: establishment.email,
          phone: establishment.phone,
          role
        }
      
        // only for admins, and workers with permission
        if (role === Role.ADMIN) {
          return {
            ...baseData,
            cnpj: establishment.cnpj
          }
        }
      
        // user comum recebe menos dados
        return baseData
      })
    
      return establishments
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
          role: true,
          active: true
        }
      })

      return users
    }

    async getWorkersByEstablishment(estabId) {
      const users = await this._prismaService.userCorporation.findMany({
        where: {
          idEstablishment: estabId,
          role: {
            in: [Role.ADMIN, Role.WORKER]
          }
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
          role: true,
          active: true
        }
      })

      return users
    }

    /** é da equipe (admin/mecânico/super), com vínculo ativo, deste estabelecimento? */
    async isActiveStaffOf(userId: number, establishmentId: number): Promise<boolean> {
      const m = await this._prismaService.userCorporation.findFirst({
        where: { idUser: userId, idEstablishment: establishmentId, active: true, role: { in: [Role.ADMIN, Role.WORKER, Role.SUPERUSER] } },
        select: { idUser: true },
      });
      return !!m;
    }

    /** vínculo ativo? (checado a cada requisição autenticada) */
    async isMembershipActive(userId: number, enterpriseId: number, establishmentId: number): Promise<boolean> {
      const m = await this._prismaService.userCorporation.findUnique({
        where: { idUser_idEnterprise_idEstablishment: { idUser: userId, idEnterprise: enterpriseId, idEstablishment: establishmentId } },
        select: { active: true },
      });
      return !!m?.active;
    }
}