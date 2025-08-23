import { LoginDTO } from "../dto/login.dto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";
import { BcryptService } from "src/crypto/bcrypt.service";
import { JWTService } from "./jwt.service"
import { EmailMaskService } from "../../shared/mask-email.service"

@Injectable()
export class AuthService {

    constructor(
      private readonly _prisma : PrismaService,
      private readonly _bcryptService : BcryptService,
      private readonly _jwtService: JWTService,
      private readonly _emailMaskService: EmailMaskService 
    ) {};

    async login(data: LoginDTO) {
      try {
        const userFound = await this._prisma.user.findFirst({
          where: {
            OR: [
              { username: data.username },
              { email: data.email }
            ],
          },
          select: {
            email: true,
            username: true,
            password: true,
          }
        });
 
        // se não existe usuário e a senha for inválida
        if(!userFound || !(await this._bcryptService.hashPasswordCompare(data.password, userFound.password))) throw new BadRequestException('Invalid credentials')

        const token = await this._jwtService.generateToken({ role: 'admin' });

        return { message: 'Authorized' }

      } catch (err) {
        throw new BadRequestException('Invalid credentials')
      } 
    }
}