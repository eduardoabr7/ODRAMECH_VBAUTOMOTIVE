import { Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import { Role } from "@prisma/client";
import { EnterpriseService } from "../services/enterprise.service";
import { EnterpriseWithEstablishmentDTO } from "../dto/enterprise-with-establishment.dto";
import { AuthPayload } from "src/auth/interfaces/auth-payload.interface";
import { CurrentAuth } from "src/core/auth/current-auth.decorator";
import { assertManager } from "src/shared/utils/role.util";

@Controller('enterprise')
export class EnterpriseController {

    constructor(
        private readonly _enterpriseService: EnterpriseService
    ){}

    /** lista TODAS as empresas do sistema — só para o super usuário (suporte Odramech) */
    @Get()
    getAllEnterprises(@CurrentAuth() auth: AuthPayload) {
        if (auth.role !== Role.SUPERUSER) throw new ForbiddenException('Sem permissão.');
        return this._enterpriseService.getAll();
    }

    /** estabelecimentos de uma empresa — só se o usuário tem vínculo ativo com ela */
    @Get('establishments/:idEnterprise')
    async getAllEstablishmentsFromEnterprise(@Param('idEnterprise', ParseIntPipe) idEnterprise: number, @CurrentAuth() auth: AuthPayload) {
        if (!(await this._enterpriseService.userBelongsTo(auth.sub, idEnterprise))) {
            throw new ForbiddenException('Você não tem acesso a esta empresa.');
        }
        return this._enterpriseService.getAllEstablishmentsFromEnterprise(idEnterprise);
    }

    /** cria uma empresa nova com o primeiro estabelecimento; quem cria vira o administrador dela */
    @Post('establishment')
    createEnterpriseWithEstablishment(@Body() body: EnterpriseWithEstablishmentDTO, @CurrentAuth() auth: AuthPayload) {
        assertManager(auth.role);
        return this._enterpriseService.createEnterpriseWithEstablishment(body, auth.sub)
    }

}
