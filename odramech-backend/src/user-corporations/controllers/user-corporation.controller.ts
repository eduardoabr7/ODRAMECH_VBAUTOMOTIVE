import { Body, Controller, Get, Param, ParseIntPipe, Post, Req } from "@nestjs/common";
import { UserCorporationService } from "../services/user-corporation.service";

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
      const userId = req.authContext.id;

      return this._userCorporationService.getUserCorporationsByUserId(userId);
    }

}