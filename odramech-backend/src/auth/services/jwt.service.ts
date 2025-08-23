import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JWTService {
    
    constructor( private readonly _jwtService: JwtService ) {}

    async validateToken(token: string): Promise<boolean> {
        try {
            const payload = this._jwtService.verify(token)
            return true
        } catch (err) {
            throw new UnauthorizedException('Acesso inválido ou expirado');
        }
    }

    async generateToken(payload = {}): Promise<string> {
        return this._jwtService.signAsync(payload)
    }

    async decoderToken<T>(token: string): Promise<T> {
        return this._jwtService.decode(token)
    }

}