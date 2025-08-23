import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class BcryptService {

    private readonly saltRounds: number = 11;

    async hashPassword(password): Promise<string> {
        return await bcrypt.hash(password, this.saltRounds);
    }

    async hashPasswordCompare(password: string, hash: string): Promise<boolean> {
        return await bcrypt.compare(password, hash);
    }
}