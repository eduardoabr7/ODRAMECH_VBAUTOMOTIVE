import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common'
import { AuthService } from '../services/auth.service'
import { CustomLogger } from 'src/shared/services/custom-logger.service';
import { EmailMaskService } from 'src/shared/services/mask-email.service';
import type { Response } from "express";
import { Public } from '../../shared/decorators/public-routes.decorator';
import { LoggedUser } from '../dto/logged-user.dto';
import { NoPublicRoutesGuard } from 'src/shared/guards/no-public-routes.guard';
import { RequestWithUser } from '../dto/request-with-user.dto';
import { PreLoginDTO } from '../dto/pre-login.dto';
import { LoginDTO } from '../dto/login.dto';

@Controller('auth')
export class AuthController {

    private readonly logger = new CustomLogger()
    constructor(
        private readonly _authService: AuthService,
        private readonly _emailMaskService: EmailMaskService
    ) {
        this.logger.setContextModule(AuthController.name);
    }

    @Post('login')
    @Public()
    login(@Body() data: LoginDTO, @Res({ passthrough: true }) res: Response) {
        this.logger.log(`Tentativa de login: ` + this._emailMaskService.mask(data.email), '#89cdce')

        return this._authService.login(data, res);
    }

    @Post('validateLogin')
    @Public()
    async validateLogin(@Body() data: PreLoginDTO, @Res({ passthrough: true }) res: Response) {
        const validate = await this._authService.validUserCredentialsLogin(data, res);

        this.logger.log(`Validando credenciais para: ` + this._emailMaskService.mask(data.email), '#89cdce')
        
        if (validate) this.logger.log(`Credenciais validadas para: ` + this._emailMaskService.mask(data.email), '#7ddf92')
        else this.logger.warn(`Credenciais inválidas para: ${this._emailMaskService.mask(data.email)}`);

        return validate;
    }

    @Post('logout')
    logout(@Res({ passthrough: true }) res: Response) {
        return this._authService.logout(res);
    }

    @Get('user')
    getUserLogged(@Req() request: RequestWithUser): LoggedUser {
        const userLogged = request.user
        this.logger.log('Dados de usuário autenticado enviado na requisição', '#3980b0')
        return userLogged
    }

    @Get('status/section')
    statusSection(){
        this.logger.log('[VERIFICA STATUS] Mensagem: Autenticated enviada na requisição', '#b7eeff')
        return { message: 'Authenticated' }
    }
    
}