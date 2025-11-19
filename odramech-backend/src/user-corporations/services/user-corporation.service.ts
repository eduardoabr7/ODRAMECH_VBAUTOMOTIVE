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

}