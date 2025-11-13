import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { PUBLIC_KEY } from '../decorators/public-routes.decorator'
import { Reflector } from '@nestjs/core'
import { JWTService } from 'src/auth/services/jwt.service';
import { PrismaService } from 'src/prisma/prisma-service';

export interface TokenDecodified {
  sub: number
}

export interface LoggedUser {
  name: string
  username: string
  email: string | null
  phone: string | null
}

@Injectable()
export class NoPublicRoutesGuard implements CanActivate {
    constructor(
        private readonly _reflector: Reflector,
        private readonly _jwtService: JWTService,
        private readonly _prisma: PrismaService
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

    // QUANDO CHEGA AQUI: O token é válido, a lógica de busca do usuário prossegue
    const tokenDecodified: TokenDecodified = await this._jwtService.decoderToken(token);
    
    const userLogged = await this._prisma.user.findUnique({
      where: {
        id: tokenDecodified.sub
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true
      }
    });

    if (!userLogged) {
      throw new UnauthorizedException("Usuário não encontrado.");
    }

    request.user = userLogged;
    return true;
  }
}