import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { LoginData } from '@shared/models/LoginData';
import { UserLogged } from '@shared/models/UserLogged';
import { NestAPI } from '@shared/services/nest-api.service';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject, catchError, firstValueFrom, Observable, switchMap, tap, throwError } from 'rxjs';

export type StatusLogin = 'off' | 'on' | 'expired'

@Injectable({
  providedIn: 'root'
})
export class AuthService {
    private readonly _isLoggedIn = new BehaviorSubject<boolean>(true);
    isLoggedIn$ = this._isLoggedIn.asObservable();

    private readonly _user = new BehaviorSubject<UserLogged | null>(null);
    user$ = this._user.asObservable();

    constructor(
      private readonly _nestApi: NestAPI,
      private readonly _router: Router,
      private _toast: ToastrService
    ) {
    }

    login(data: LoginData): Observable<any> {
      return this._nestApi.post('auth/login', data).pipe(
        switchMap(() => this.getUserLogged().pipe(
          catchError((err: HttpErrorResponse) => {
            // Se a chamada getUserLogged falhar, define o usuário como null
            this.setUserLogged(null);
            // Retorne um Observable vazio para que o fluxo não quebre
            return throwError(() => err); 
          })
        )),
        tap((user: UserLogged) => {
          // Quando o login for bem-sucedido, define o usuário
          this.setUserLogged(user);
        })
      );
    }

    logout(): Observable<any> {
      return this._nestApi.post('auth/logout', {}).pipe(
        tap(() => {
          this._isLoggedIn.next(false);
          this._router.navigateByUrl('/login');
          this._toast.info('Sessão encerrada');
        }),
        catchError((err: HttpErrorResponse) => {
          this._toast.warning('A sessão foi encerrada, porém com ressalvas: ' + err.message);
          this._isLoggedIn.next(false);
          this._router.navigateByUrl('/login');
          return throwError(() => err); // propaga o erro para que o componente possa reagir, se necessário
        })
      );
    }

    getUserLogged(): Observable<UserLogged> {
      return this._nestApi.get<UserLogged>('auth/user');
    }

    setStatusLogin(status: StatusLogin) {
      switch(status){
        case 'off': this._isLoggedIn.next(false);
          break
        case 'on': this._isLoggedIn.next(true);
          break
      }
    }

    setUserLogged(user: UserLogged | null) {
      this._user.next(user);
    }
}