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

    async getUserCorporationsByUserId(userId: number) {
      const userCorporations = await this._prismaService.userCorporation.findMany({
        where: { idUser: userId },
        include: {
          establishment: true,
          enterprise: true
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


}