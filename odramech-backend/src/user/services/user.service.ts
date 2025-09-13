import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";

@Injectable()
export class UserService {

    constructor(
        private readonly _prismaService: PrismaService
    ){}
    
    async userCorporationById(idUser) {
        const user = await this._prismaService.user.findMany({
            where: {
                id: idUser
            },
            select: {
                userCorporation: true
            }
        });

        return user
    }

}