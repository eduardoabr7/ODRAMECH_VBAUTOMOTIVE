import { Body, Controller, Get, Param, ParseIntPipe, Post, Req } from "@nestjs/common";
import { UserCorporationService } from "../services/user-corporation.service";
import { AuthPayload } from "src/auth/interfaces/auth-payload.interface";

interface GetEstablishmentById {
  idEstab: number
}

@Controller('usercorp')
export class UserCorporationController {
    
    constructor(
        private readonly _userCorporationService: UserCorporationService
    ){}

    @Post()
    createUserCorporation(@Body() data) {
        return this._userCorporationService.createUserCorporation(data)
    }

    @Get()
    getCorporationsByUserId(@Req() req) {
      const request = req.authContext as AuthPayload
      const userId = request.sub;

      return this._userCorporationService.getUserCorporationsByUserId(userId);
    }

    @Get('westablishments')
    getEstablishmentsOnAdmin(@Req() req) {
      const request = req.authContext as AuthPayload

      return this._userCorporationService.getEstablishmentsOnAdminOrWorker(request.enterpriseId, request.sub)
    }

    @Get('establishments')
    getEstablishments(@Req() req) {
      const request = req.authContext as AuthPayload

      return this._userCorporationService.getEstablishments(request.enterpriseId, request.sub)
    }

    @Post('establishment-users')
    getUsersByIdEstab(@Body() data: GetEstablishmentById) {
      return this._userCorporationService.getUsersByEstablishment(Number(data.idEstab))
    }

}