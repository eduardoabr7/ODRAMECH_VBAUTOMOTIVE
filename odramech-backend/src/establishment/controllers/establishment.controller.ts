import { Body, Controller, InternalServerErrorException, Post } from "@nestjs/common";
import { EstablishmentCreateDTO } from "../dto/establishment-create.dto";
import { EstablishmentService } from "../services/establishment.service";
import { CustomLogger } from "src/shared/services/custom-logger.service";

@Controller('establishment')
export class EstablishmentController {

    private readonly _logger = new CustomLogger()

    constructor(
        private readonly _establishmentService: EstablishmentService
    ){
        this._logger.setContextModule(EstablishmentController.name);
    }

    @Post()
    async addEstablishment(@Body() data: EstablishmentCreateDTO) {
      this._logger.warn(`Criando estabelecimento para empresa id: ${data.enterpriseId}`);
    
      const value = await this._establishmentService.createEstablishment(data);
    
      this._logger.log(
        `Estabelecimento ${data.name} criado para empresa id: ${data.enterpriseId}`,
        '#a7ffa7'
      );
  
      return value;
    }
}