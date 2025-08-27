import { LoginDTO } from "../dto/login.dto";
import { BadRequestException, Injectable, Req } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";
import { BcryptService } from "src/crypto/bcrypt.service";
import { JWTService } from "./jwt.service"
import { Response } from 'express';
import { LoggedUser } from "../dto/logged-user.dto";

@Injectable()
export class AuthService {

    constructor(
      private readonly _prisma : PrismaService,
      private readonly _bcryptService : BcryptService,
      private readonly _jwtService: JWTService,
    ) {};

    async login(data: LoginDTO, res: Response) {
      try {
        const userFound = await this._prisma.user.findFirst({
          where: {
            OR: [
              { username: data.username },
              { email: data.email }
            ],
          },
          select: {
            id: true,
            email: true,
            username: true,
            password: true,
          }
        });
 
        // se não existe usuário e a senha for inválida
        if(!userFound || !(await this._bcryptService.hashPasswordCompare(data.password, userFound.password))) throw new BadRequestException('Invalid credentials')

        const payload = { sub: userFound.id }

        const token = await this._jwtService.generateToken(payload);

        res.cookie('access', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 5400000 // 1 hora e 30 min, passou disso o navegador remove o cookie
        })

        return { message: 'Authenticated' }

      } catch (err) {
        throw new BadRequestException('Invalid credentials')
      } 
    }
}