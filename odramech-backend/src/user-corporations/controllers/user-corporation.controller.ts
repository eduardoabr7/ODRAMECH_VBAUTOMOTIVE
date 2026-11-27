import { Body, Controller, ForbiddenException, Get, Post } from "@nestjs/common";
import { IsInt } from "class-validator";
import { UserCorporationService } from "../services/user-corporation.service";
import { AuthPayload } from "src/auth/interfaces/auth-payload.interface";
import { CurrentAuth } from "src/core/auth/current-auth.decorator";
import { assertStaff } from "src/shared/utils/role.util";

class EstablishmentIdDTO {
  @IsInt()
  idEstab: number;
}

/**
 * Vínculos usuário ↔ empresa/estabelecimento.
 *
 * Segurança: tudo é resolvido a partir da SESSÃO (token assinado), nunca do corpo da requisição.
 * A antiga rota `POST /usercorp` (criava vínculo com qualquer papel, em qualquer estabelecimento,
 * com o que viesse no corpo) foi removida: vínculos agora só nascem pelos cadastros de usuário
 * (UserFactory, com política de quem cria quem) e pela criação de empresa/estabelecimento.
 */
@Controller('usercorp')
export class UserCorporationController {

    constructor(
        private readonly _userCorporationService: UserCorporationService
    ){}

    @Get()
    getCorporationsByUserId(@CurrentAuth() auth: AuthPayload) {
      return this._userCorporationService.getUserCorporationsByUserId(auth.sub);
    }

    @Get('westablishments')
    getEstablishmentsOnAdmin(@CurrentAuth() auth: AuthPayload) {
      return this._userCorporationService.getEstablishmentsOnAdminOrWorker(auth.enterpriseId, auth.sub)
    }

    @Get('establishments')
    getEstablishments(@CurrentAuth() auth: AuthPayload) {
      return this._userCorporationService.getEstablishments(auth.enterpriseId, auth.sub)
    }

    /**
     * Pessoas de um estabelecimento — só para quem é da EQUIPE (ativo) daquele estabelecimento.
     * Um admin com várias unidades vê cada uma em que trabalha; nunca as de quem não tem vínculo.
     */
    @Post('establishment-users')
    async getUsersByIdEstab(@Body() data: EstablishmentIdDTO, @CurrentAuth() auth: AuthPayload) {
      await this.assertStaffOf(auth, data.idEstab);
      return this._userCorporationService.getUsersByEstablishment(data.idEstab)
    }

    @Post('establishment-workers')
    async getWorkersByIdEstab(@Body() data: EstablishmentIdDTO, @CurrentAuth() auth: AuthPayload) {
      await this.assertStaffOf(auth, data.idEstab);
      return this._userCorporationService.getWorkersByEstablishment(data.idEstab)
    }

    private async assertStaffOf(auth: AuthPayload, idEstab: number) {
      assertStaff(auth.role);
      if (auth.context !== 'AUTH' || !(await this._userCorporationService.isActiveStaffOf(auth.sub, idEstab))) {
        throw new ForbiddenException('Você não faz parte da equipe deste estabelecimento.');
      }
    }
}
