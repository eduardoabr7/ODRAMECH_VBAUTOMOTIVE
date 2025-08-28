import { Injectable } from '@angular/core';
import { LoginData } from '@shared/models/LoginData';
import { NestAPI } from '@shared/services/nest-api.service'
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
    constructor(
      private readonly _nestApi: NestAPI
    ) {}

    async login(data: LoginData): Promise<any> {
      return await firstValueFrom(this._nestApi.post('auth/login', data));
    }

    async isAuthenticated(): Promise<boolean> {
      try {
        await firstValueFrom(this._nestApi.get('auth/status/section'));
        return true;
      } catch (error) {
        return false;
      }
    }

    async getUserLogged(): Promise<any> {
      return await firstValueFrom(this._nestApi.get('auth/user'));
    }
}