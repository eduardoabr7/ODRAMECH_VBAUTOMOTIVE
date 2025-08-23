import { Body, Controller, Post, Req } from '@nestjs/common'
import { AuthService } from '../services/auth.service'
import { LoginDTO } from '../dto/login.dto'
import { CustomLogger } from 'src/shared/custom-logger.service';
import { EmailMaskService } from 'src/shared/mask-email.service';


@Controller('auth')
export class AuthController {

    private readonly logger = new CustomLogger()

    constructor(
        private readonly _authService: AuthService,
        private readonly _emailMaskService: EmailMaskService 
    ){
        this.logger.setContextModule(AuthController.name);
    }

    @Post('login')
    login(@Req() request: Request, @Body() data: LoginDTO) {
        if(data.email) this.logger.warn(`Tentativa de login: `+this._emailMaskService.mask(data.email))
        else this.logger.log(`Tentativa de login: usuário `+data.username)
        return this._authService.login(data);    
    }
}