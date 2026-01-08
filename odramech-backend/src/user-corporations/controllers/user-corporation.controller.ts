import { Body, Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
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

    @Get(':id')
    getCorporationsByUserId(@Param('id') id: number) {
        return this._userCorporationService.getUserCorporationsByUserId(id);
    }

}