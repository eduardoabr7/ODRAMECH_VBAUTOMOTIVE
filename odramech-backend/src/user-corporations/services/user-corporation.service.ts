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

    async getUserCorporationsByUserId(id: number) {
        const userCorporations = await this._prismaService.userCorporation.findMany({
            where: { idUser: id },
            include: {
                establishment: true,
                enterprise: true,
            },
        });

        // Agrupar por empresa
        const grouped = userCorporations.reduce((acc, curr) => {
            const enterpriseId = curr.idEnterprise;

            // Se ainda não existe a empresa no acumulador
            if (!acc[enterpriseId]) {
                acc[enterpriseId] = {
                    enterprise: curr.enterprise,
                    establishments: [],
                };
            }

            // Adiciona o estabelecimento ao array da empresa
            acc[enterpriseId].establishments.push({
                ...curr.establishment,
                role: curr.role, // manter o role do usuário nesse estabelecimento
            });

            return acc;
        }, {} as Record<number, { enterprise: any; establishments: any[] }>);

        // Transformar de objeto para array e retornar
        return Object.values(grouped);
    }


}