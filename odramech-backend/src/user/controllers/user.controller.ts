import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { UserService } from "../services/user.service";
import { AuthPayload } from "src/auth/interfaces/auth-payload.interface";
import { FrontEndCreateUser } from "../dto/create-user.dto";

@Controller('user')
export class UserController {
    
    constructor(
        private readonly _userService: UserService
    ){}

    @Post('create')
    createUser(@Body() data: FrontEndCreateUser, @Req() req){
        const { establishmentId, enterpriseId } = req.authContext as AuthPayload;
        const dataWithCredentials = {establishmentId, enterpriseId, ...data}

        return this._userService.create(dataWithCredentials)
    }

    @Get('search')
    search(@Query('term') term: string) {
        return this._userService.search(term);
    }

}