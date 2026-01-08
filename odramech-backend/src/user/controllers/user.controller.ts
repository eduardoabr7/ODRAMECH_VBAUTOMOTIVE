import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { UserService } from "../services/user.service";

@Controller('user')
export class UserController {
    
    constructor(
        private readonly _userService: UserService
    ){}

}