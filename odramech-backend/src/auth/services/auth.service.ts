import { LoginDTO } from "../dto/login.dto";
import { BadRequestException, Injectable, Req, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";
import { BcryptService } from "src/crypto/bcrypt.service";
import { JWTService } from "./jwt.service"
import { Response } from 'express';
import { LoggedUser } from "../dto/logged-user.dto";
import { PreLoginDTO } from "../dto/pre-login.dto";
import { UserCorporationService } from "src/user-corporations/services/user-corporation.service";
import { AuthContext } from "../enums/auth-context.enum";
import { AuthPayload } from "../interfaces/auth-payload.interface";

@Injectable()
export class AuthService {

    constructor(
      private readonly _prisma : PrismaService,
      private readonly _bcryptService : BcryptService,
      private readonly _jwtService: JWTService,
      private readonly _userCorpService: UserCorporationService
    ) {};

    async login(data: LoginDTO) {
      const dataToValidateLogin = {
        email: data.email,
        password: data.password
      }

      const user = await this.validateCredentials(dataToValidateLogin)

      const relation = await this._userCorpService.validateRelationUserToEstablishment(user.id, data.tenantId)

      if (!relation) throw new UnauthorizedException('Vínculo usuário - estabelecimento não encontrado')

      const token = await this._jwtService.generateToken(
        {
          sub: user.id,
          role: relation.role,
          establishmentId: relation.idEstablishment,
          enterpriseId: relation.idEnterprise,
          context: 'AUTH',
        },
        {
          expiresIn: '15m',
        }
      ); 

      return { user, token }
    }

    async validateCredentials(data: PreLoginDTO): Promise<LoggedUser> {
      const userFound = await this._prisma.user.findFirst({
        where: {
           email: data.email 
        },
        select: {
          id: true,
          email: true,
          principalPhone: true,
          secondaryPhone: true,
          name: true,
          password: true
        }
      });

      if(!userFound || !userFound.password || !(await this._bcryptService.hashPasswordCompare(data.password, userFound.password))) 
        throw new UnauthorizedException('Invalid credentials')

      const { password, ...userWithoutPassword } = userFound;
      return userWithoutPassword as LoggedUser;
    }

    async preLogin(data: PreLoginDTO) {
      const user = await this.validateCredentials(data)

      const temporaryToken = await this._jwtService.generateToken(
        {
          sub: user.id,
          context: 'PRE_AUTH',
        },
        {
          expiresIn: '2m',
        }
      ); 

      return {user, temporaryToken};
    }

    async logout(res: Response) {
      res.clearCookie('access');
      return { message: 'Session terminated' }
    }

    async getMeAuthContext(payloadJwt: AuthPayload): Promise<any> {
      const value = await this._prisma.user.findUnique({
        where: {
          id: payloadJwt.sub
        },
        select: {
          id: true,
          name: true,
          email: true,
          principalPhone: true
        }
      });

      if (!value) {
        throw new UnauthorizedException("Usuário não encontrado.");
      }

      const usercorp = payloadJwt.context === 'PRE_AUTH' ? null : await this._userCorpService.getUserCorporationByEstablishmentId(payloadJwt.establishmentId);

      const user = {...value, context: payloadJwt.context}

      const authContext = {
        user, 
        usercorp
      }

      return authContext;
    }
}