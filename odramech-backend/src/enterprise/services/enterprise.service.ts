import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";

@Injectable()
export class EnterpriseService {

    constructor(
        private readonly _prisma : PrismaService
    ){}

    async getAll(){
        return await this._prisma.enterprise.findMany();
    }

}