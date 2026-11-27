import { Body, Controller, ForbiddenException, Get, Post } from "@nestjs/common";
import { IsInt } from "class-validator";
import { UserCorporationService } from "../services/user-corporation.service";
import { AuthPayload } from "src/auth/interfaces/auth-payload.interface";
import { CurrentAuth } from "src/core/auth/current-auth.decorator";
import { assertStaff } from "src/shared/utils/role.util";
import { AllowWhenBlocked } from 'src/subscription/allow-when-blocked.decorator';

class EstablishmentIdDTO {
  @IsInt()
  idEstab: number;
}

// Vínculos usuário x empresa/estabelecimento. Tudo sai da sessão, nunca do body.
// O POST /usercorp antigo foi removido (deixava criar vínculo com qualquer papel).
@Controller('usercorp')
export class UserCorporationController {

    constructor(
        private readonly _userCorporationService: UserCorporationService
    ){}

    @AllowWhenBlocked()
    @Get()
    getCorporationsByUserId(@CurrentAuth() auth: AuthPayload) {
      return this._userCorporationService.getUserCorporationsByUserId(auth.sub);
    }

    @AllowWhenBlocked()
    @Get('westablishments')
    getEstablishmentsOnAdmin(@CurrentAuth() auth: AuthPayload) {
      return this._userCorporationService.getEstablishmentsOnAdminOrWorker(auth.enterpriseId, auth.sub)
    }

    @AllowWhenBlocked()
    @Get('establishments')
    getEstablishments(@CurrentAuth() auth: AuthPayload) {
      return this._userCorporationService.getEstablishments(auth.enterpriseId, auth.sub)
    }

    // pessoas do estabelecimento, só pra quem é da equipe ativa dele
    @AllowWhenBlocked()
    @Post('establishment-users')
    async getUsersByIdEstab(@Body() data: EstablishmentIdDTO, @CurrentAuth() auth: AuthPayload) {
      await this.assertStaffOf(auth, data.idEstab);
      return this._userCorporationService.getUsersByEstablishment(data.idEstab)
    }

    @AllowWhenBlocked()
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
