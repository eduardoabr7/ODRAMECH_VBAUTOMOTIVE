import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";

@Injectable()
export class UserService {

    constructor(
        private readonly _prismaService: PrismaService
    ){}
    
    async userCorporationById(idUser: number) {
        const user = await this._prismaService.user.findUnique({ 
            where: {
                id: idUser
            },
            select: {
                userCorporation: {
                    select: {
                        enterprise: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        establishment: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        role: true
                    }
                }
            }
        });

        if (!user || !user.userCorporation || user.userCorporation.length === 0) {
            return [];
        }

        // processo de agrupamento usando reduce
        const groupedData = user.userCorporation.reduce((acc, current) => {
            const enterpriseId = current.enterprise.id;

            // cria o objeto do estabelecimento com o 'role'
            const establishmentWithRole = {
                ...current.establishment,
                role: current.role
            };

            // verifica se a empresa já foi adicionada ao acumulador
            if (!acc[enterpriseId]) {
                // se não, adiciona a empresa e o primeiro estabelecimento com o role
                acc[enterpriseId] = {
                    ...current.enterprise,
                    establishments: [establishmentWithRole]
                };
            } else {
                // se sim, apenas adiciona o estabelecimento (com o role) ao array de estabelecimentos
                acc[enterpriseId].establishments.push(establishmentWithRole);
            }

            return acc;
        }, {});

        // converte o objeto de volta para um array de valores
        return Object.values(groupedData);
    }
}