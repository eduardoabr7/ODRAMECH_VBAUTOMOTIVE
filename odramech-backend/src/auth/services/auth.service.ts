import { LoginDTO } from "../dto/login.dto";
import { BadRequestException, Injectable, Req, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";
import { BcryptService } from "src/crypto/bcrypt.service";
import { JWTService } from "./jwt.service"
import { Response } from 'express';
import { LoggedUser } from "../dto/logged-user.dto";
import { PreLoginDTO } from "../dto/pre-login.dto";

@Injectable()
export class AuthService {

    constructor(
      private readonly _prisma : PrismaService,
      private readonly _bcryptService : BcryptService,
      private readonly _jwtService: JWTService,
    ) {};

    async login(data: LoginDTO, res: Response) {
      

      return data
    }

    async validUserCredentialsLogin(data: PreLoginDTO, res: Response): Promise<LoggedUser> {
      const userFound = await this._prisma.user.findFirst({
        where: {
           email: data.email 
        },
        select: {
          id: true,
          email: true,
          phone: true,
          name: true,
          password: true
        }
      });

      if(!userFound || !(await this._bcryptService.hashPasswordCompare(data.password, userFound.password))) throw new UnauthorizedException('Invalid credentials')

      const temporaryToken = await this._jwtService.generateToken(
        {
          sub: userFound.id,
          context: 'PRE_AUTH',
        },
        {
          expiresIn: '2m',
        }
      ); 

      res.cookie('access', temporaryToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 120_000
      }) 
      const { password, ...userWithoutPassword } = userFound;
      return userWithoutPassword as LoggedUser;
    }



    //     const payload = { sub: userFound.id }

    //     const token = await this._jwtService.generateToken(payload);

    //     res.cookie('access', token, {
    //       httpOnly: true,
    //       secure: process.env.NODE_ENV === 'production',
    //       sameSite: 'strict',
    //       maxAge: 900000 // 15 minutos
    //     })

    //     const { password, ...userWithoutPassword } = userFound;
    //     return userWithoutPassword;

    //   } catch (err) {
    //     throw new BadRequestException('Invalid credentials')
    //   } 
    // }

    async logout(res: Response) {
      res.clearCookie('access');
      return { message: 'Session terminated' }
    }
}