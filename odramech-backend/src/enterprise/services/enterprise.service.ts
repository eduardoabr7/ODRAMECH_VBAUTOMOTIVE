import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";
import { EstablishmentDTO } from "../establishment/dto/establishment.dto";

@Injectable()
export class EnterpriseService {

    constructor(
        private readonly _prisma : PrismaService
    ){}

    async getAll(){
        return await this._prisma.enterprise.findMany();
    }

    async getAllEstablishmentsFromEnterprise(idEnterprise: number): Promise<EstablishmentDTO[]>{
        const enterprise = await this._prisma.enterprise.findUnique({
            where: {
                id: idEnterprise,
            },
            select: {
                establishments: {
                    select: {
                        establishment: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            } 
        });

        return enterprise?.establishments.map(e => e.establishment) ?? [];
    }
}