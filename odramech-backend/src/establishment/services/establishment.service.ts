import { ConflictException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { EstablishmentUpdateDTO } from "../dto/establishment-update.dto";
import { AuthPayload } from "src/auth/interfaces/auth-payload.interface";
import { EstablishmentCreateDTO } from "../dto/establishment-create.dto";
import { PrismaService } from "src/prisma/prisma-service";
import { Role } from "@prisma/client";

@Injectable()
export class EstablishmentService {

    constructor(
        private readonly _prisma : PrismaService
    ){}

    /**
     * Edita um estabelecimento. Só o ADMIN (ativo) DAQUELE estabelecimento, dentro da empresa da
     * sessão — o id vem da URL, então tudo é conferido no banco.
     */
    async updateEstablishment(auth: AuthPayload, id: number, { address, ...data }: EstablishmentUpdateDTO) {
      const est = await this._prisma.establishment.findFirst({
        where: { id, enterpriseId: auth.enterpriseId },
        select: { id: true },
      });
      if (!est) throw new NotFoundException('Estabelecimento não encontrado.');

      const admin = await this._prisma.userCorporation.findFirst({
        where: { idUser: auth.sub, idEstablishment: id, active: true, role: { in: [Role.ADMIN, Role.SUPERUSER] } },
        select: { idUser: true },
      });
      if (!admin) throw new ForbiddenException('Só administradores deste estabelecimento podem editá-lo.');

      try {
        return await this._prisma.establishment.update({
          where: { id },
          data: {
            ...(data.name !== undefined && { name: data.name.trim() }),
            ...(data.email !== undefined && { email: data.email?.trim().toLowerCase() || null }),
            ...(data.phone !== undefined && { phone: data.phone.trim() }),
            ...(data.cnpj !== undefined && { cnpj: data.cnpj.trim() }),
            ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
            ...(address && { address: { update: { ...address, complement: address.complement ?? null } } }),
          },
          include: { address: true },
        });
      } catch (error: any) {
        if (error.code === 'P2002') throw new ConflictException('Já existe um estabelecimento com esse CNPJ.');
        throw error;
      }
    }

    async createEstablishment({ address, enterpriseId, ...data }: EstablishmentCreateDTO, creatorUserId?: number) {
      try {
        return await this._prisma.establishment.create({
          data: {
            ...data,
            enterprise: { connect: { id: enterpriseId } },
            address: { create: address },
            counter: { create: {} },
            // quem cria o estabelecimento já entra como ADMIN dele
            ...(creatorUserId && {
              users: {
                create: { idUser: creatorUserId, idEnterprise: enterpriseId, role: Role.ADMIN },
              },
            }),
          },
          include: { address: true },
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