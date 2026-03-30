import { ConflictException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { EstablishmentCreateDTO } from "../dto/establishment-create.dto";
import { PrismaService } from "src/prisma/prisma-service";

@Injectable()
export class EstablishmentService {

    constructor(
        private readonly _prisma : PrismaService
    ){}

    async createEstablishment({ address, enterpriseId, ...data }: EstablishmentCreateDTO) {
      try {
        return await this._prisma.establishment.create({
          data: {
            ...data,
            enterprise: { connect: { id: enterpriseId } },
            address: { create: address },
          },
        });
      } catch (error: any) {
        // prisma lança erro com código P2002 para unique constraint (ex: CNPJ duplicado)
        if (error.code === 'P2002') {
          throw new ConflictException(`Registro já existe: ${error.meta?.target}`);
        }

        // erros genéricos viram 500
        console.error('Erro ao criar estabelecimento:', error);
        throw new InternalServerErrorException('Erro ao criar estabelecimento', error);
      }
    }

}