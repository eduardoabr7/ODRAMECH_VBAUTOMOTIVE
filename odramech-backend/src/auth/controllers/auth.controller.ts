import { Body, Controller, Post } from '@nestjs/common'
import { AuthService } from '../services/auth.service'
import { LoginDTO } from '../dto/login.dto'

@Controller('auth')
export class AuthController {
    constructor(private readonly _authService: AuthService) {}

    @Post('login')
    login(@Body() data: LoginDTO) {
        return this._authService.login(data);    
    }
}