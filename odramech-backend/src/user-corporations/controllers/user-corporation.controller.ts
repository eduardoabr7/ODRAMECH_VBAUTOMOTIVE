import { Body, Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import { UserCorporationService } from "../services/user-corporation.service";

@Controller('usercorp')
export class UserCorporationController {
    
    constructor(
        private readonly _userService: UserCorporationService
    ){}

    @Post()
    createUserCorporation(@Body() data) {
        return this._userService.createUserCorporation(data)
    }

}