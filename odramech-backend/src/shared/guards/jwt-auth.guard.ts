import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { PUBLIC_KEY } from '../decorators/public-routes.decorator'
import { Reflector } from '@nestjs/core'
import { JWTService } from 'src/auth/services/jwt.service';
import {  } from 'src/auth/enums/auth-context.enum';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { PrismaService } from 'src/core/database/prisma.service';

/** o que o token de pré-login pode chamar: o fluxo de escolher empresa/estabelecimento */
const PRE_AUTH_ROUTES = [/^\/auth\//, /^\/usercorp\/?$/, /^\/enterprise\/establishments\/\d+$/];

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly _reflector: Reflector,
        private readonly _jwtService: JWTService,
        private readonly _prisma: PrismaService,
    ) {}


  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this._reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = request.cookies['access'];

    if (!token) {
      throw new UnauthorizedException("Chave de acesso não informada");
    }

    await this._jwtService.validateToken(token);

    const tokenDecodified: AuthPayload = await this._jwtService.decoderToken(token);

    // token de pré-login só serve pra terminar o login (ainda não tem empresa nem perfil)
    if (tokenDecodified?.context !== 'AUTH') {
      const path: string = (request.path ?? request.url ?? '').split('?')[0];
      if (!PRE_AUTH_ROUTES.some(r => r.test(path))) throw new UnauthorizedException('Escolha o estabelecimento para continuar.');
    }

    // desativado perde o acesso na hora, sem esperar a sessão expirar
    if (tokenDecodified?.context === 'AUTH') {
      const membership = await this._prisma.userCorporation.findUnique({
        where: {
          idUser_idEnterprise_idEstablishment: {
            idUser: tokenDecodified.sub,
            idEnterprise: tokenDecodified.enterpriseId,
            idEstablishment: tokenDecodified.establishmentId,
          },
        },
        select: { active: true, role: true },
      });
      if (!membership?.active) throw new UnauthorizedException('Seu acesso a este estabelecimento foi desativado.');
      // o perfil vale o que está no banco agora (ex.: admin rebaixado perde o acesso na hora)
      tokenDecodified.role = membership.role;
    }

    request.authContext = tokenDecodified

    return true;
  }
}