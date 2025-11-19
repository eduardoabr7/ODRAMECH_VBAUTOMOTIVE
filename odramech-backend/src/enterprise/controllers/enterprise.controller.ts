import { Body, Controller, Get, LoggerService, Param, Post } from "@nestjs/common";
import { EnterpriseService } from "../services/enterprise.service";
import { CustomLogger } from "src/shared/services/custom-logger.service";
import { EnterpriseWithEstablishmentDTO } from "../dto/enterprise-with-establishment.dto";

@Controller('enterprise')
export class EnterpriseController {

    private readonly _logger = new CustomLogger()

    constructor(
        private readonly _enterpriseService: EnterpriseService
    ){
        this._logger.setContextModule(EnterpriseController.name);
    }

    @Get()
    async getAllEnterprises() {
        const enterprises = await this._enterpriseService.getAll();
        // Converte o array de empresas para uma string JSON formatada
        const enterprisesJson = JSON.stringify(enterprises, null, 2);
    
        this._logger.log(`Retornando empresas: ${enterprisesJson}`, '#00ca9f');
        return enterprises;
    }

    @Get('establishments/:idEnterprise')
    getAllEstablishmentsFromEnterprise(@Param('idEnterprise') idEnterprise: number){
        this._logger.log('Retornando estabelecimentos da empresa ID: '+idEnterprise, '#00ffb2');
        return this._enterpriseService.getAllEstablishmentsFromEnterprise(idEnterprise);
    }

    @Post('establishment')
    createEnterpriseWithEstablishment(
        @Body() body: EnterpriseWithEstablishmentDTO) {
        return this._enterpriseService.createEnterpriseWithEstablishment(body)
    }

}