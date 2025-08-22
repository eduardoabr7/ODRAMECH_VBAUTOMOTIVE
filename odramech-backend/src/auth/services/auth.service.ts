import { LoginDTO } from "../dto/login.dto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma-service";

@Injectable()
export class AuthService {

    constructor(private readonly _prisma : PrismaService) {};

    async login(data: LoginDTO) {
        if(!data.email && !data.username) throw new BadRequestException ('Informe usuário ou e-mail');
    
        const usuarioEncontrado = await this._prisma.user.findFirst({
          where: {
            OR: [
              { username: data.username },
              { email: data.email }
            ]
          },
          select: {
            email: true,
            username: true,
            password: true,
          }
        });

        if(!usuarioEncontrado) throw new BadRequestException('Usuário/E-mail ou senha inválidos')

        return usuarioEncontrado
    }
}