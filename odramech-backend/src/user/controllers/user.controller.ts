import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { UserService } from "../services/user.service";

@Controller('user')
export class UserController {
    
    constructor(
        private readonly _userService: UserService
    ){}

    @Get('corporations/:idUser')
    getTeste(@Param('idUser', ParseIntPipe) idUser: number){
        return this._userService.getUserCorporationById(idUser);
    }

}