import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common'
import { AuthService } from '../services/auth.service'
import { LoginDTO } from '../dto/login.dto'
import { CustomLogger } from 'src/shared/services/custom-logger.service';
import { EmailMaskService } from 'src/shared/services/mask-email.service';
import type { Response } from "express";
import { Public } from '../../shared/decorators/public-routes.decorator';
import { LoggedUser } from '../dto/logged-user.dto';
import { NoPublicRoutesGuard } from 'src/shared/guards/no-public-routes.guard';
import { RequestWithUser } from '../dto/request-with-user.dto';

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
    @Public() // rotas que não são @Public só podem ser acessadas com token de autenticação
    login(@Body() data: LoginDTO, @Res({ passthrough: true }) res: Response) {
        if (data.email) this.logger.log(`Tentativa de login: ` + this._emailMaskService.mask(data.email), '#89cdce')
        else this.logger.log(`Tentativa de login: usuário ` + data.username, '#89cdce')

        return this._authService.login(data, res);
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