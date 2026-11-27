import { Module } from '@nestjs/common';
import { UserController } from './controllers/user.controller';
import { UserService } from './services/user.service';
import { UserFactory } from './factories/user.factory';
import { PrismaUserRepository, UserRepository } from './repositories/user.repository';
import { BcryptService } from 'src/crypto/bcrypt.service';

@Module({
  controllers: [UserController],
  providers: [
    UserService,
    UserFactory,
    BcryptService,
    { provide: UserRepository, useClass: PrismaUserRepository },
  ],
})
export class UserModule {}
