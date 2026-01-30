import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { PUBLIC_KEY } from '../decorators/public-routes.decorator'
import { Reflector } from '@nestjs/core'
import { JWTService } from 'src/auth/services/jwt.service';
import {  } from 'src/auth/enums/auth-context.enum';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly _reflector: Reflector,
        private readonly _jwtService: JWTService,
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
    request.authContext = tokenDecodified

    return true;
  }
}