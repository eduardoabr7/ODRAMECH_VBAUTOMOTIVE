import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common'
import { AuthService } from '../services/auth.service'
import { CustomLogger } from 'src/shared/services/custom-logger.service';
import { EmailMaskService } from 'src/shared/services/mask-email.service';
import type { Response } from "express";
import { Public } from '../../shared/decorators/public-routes.decorator';
import { LoggedUser } from '../dto/logged-user.dto';
import { RequestWithUser } from '../dto/request-with-user.dto';
import { PreLoginDTO } from '../dto/pre-login.dto';
import { LoginDTO } from '../dto/login.dto';
import { AuthPayload } from '../interfaces/auth-payload.interface';

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
    async login(@Body() data: LoginDTO, @Res({ passthrough: true }) res: Response) {
        this.logger.log(`Tentativa de login: ` + this._emailMaskService.mask(data.email), '#89cdce')

        const { user, token } = await this._authService.login(data)

        res.cookie('access', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 2 * 60 * 1000
        });

        return user;
    }

    @Post('preLogin')
    @Public()
    async preLogin(@Body() data: PreLoginDTO, @Res({ passthrough: true }) res: Response) {
        const { user, temporaryToken } = await this._authService.preLogin(data);

        res.cookie('access', temporaryToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 2 * 60 * 1000
        });

        this.logger.log(`Validando credenciais para: ` + this._emailMaskService.mask(data.email), '#89cdce')
        
        return user;
    }

    @Post('logout')
    logout(@Res({ passthrough: true }) res: Response) {
        return this._authService.logout(res);
    }

    @Post('me')
    getUserLogged(@Req() request: any) {
        const payloadJwt = request.authContext
        this.logger.log('Dados de usuário autenticado enviado na requisição', '#3980b0')
        return this._authService.getMe(payloadJwt)
    }

    @Get('status/section')
    statusSection(){
        this.logger.log('[VERIFICA STATUS] Mensagem: Autenticated enviada na requisição', '#b7eeff')
        return { message: 'Authenticated' }
    }
    
}