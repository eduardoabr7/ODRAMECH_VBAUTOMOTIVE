import { Body, Controller, Param, ParseIntPipe, Post, Put, Req } from "@nestjs/common";
import { EstablishmentUpdateDTO } from "../dto/establishment-update.dto";
import { EstablishmentCreateDTO } from "../dto/establishment-create.dto";
import { EstablishmentService } from "../services/establishment.service";
import { CustomLogger } from "src/shared/services/custom-logger.service";
import { AuthPayload } from "src/auth/interfaces/auth-payload.interface";
import { assertManager } from "src/shared/utils/role.util";
import { PlanEntitlementsService } from "src/subscription/plan-entitlements.service";

@Controller('establishment')
export class EstablishmentController {

    private readonly _logger = new CustomLogger()

    constructor(
        private readonly _establishmentService: EstablishmentService,
        private readonly _entitlements: PlanEntitlementsService,
    ){
        this._logger.setContextModule(EstablishmentController.name);
    }

    @Put(':id')
    updateEstablishment(@Param('id', ParseIntPipe) id: number, @Body() data: EstablishmentUpdateDTO, @Req() req) {
      const auth = req.authContext as AuthPayload;
      assertManager(auth.role);
      return this._establishmentService.updateEstablishment(auth, id, data);
    }

    @Post()
    async addEstablishment(@Body() data: EstablishmentCreateDTO, @Req() req) {
      const auth = req.authContext as AuthPayload;
      assertManager(auth.role);
      await this._entitlements.assertCanAddEstablishment(auth.enterpriseId);

      // a empresa sempre vem do token, nunca do corpo da requisição
      const payload = { ...data, enterpriseId: auth.enterpriseId };

      this._logger.warn(`Criando estabelecimento para empresa id: ${payload.enterpriseId}`);

      const value = await this._establishmentService.createEstablishment(payload, auth.sub);

      this._logger.log(
        `Estabelecimento ${data.name} criado para empresa id: ${payload.enterpriseId}`,
        '#a7ffa7'
      );

      return value;
    }
}
