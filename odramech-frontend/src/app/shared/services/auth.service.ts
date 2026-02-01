import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthContext } from '@shared/models/AuthContext';
import { LoginData } from '@shared/models/LoginData';
import { PreLogin } from '@shared/models/PreLogin';
import { UserLogged } from '@shared/models/UserLogged';
import { NestAPI } from '@shared/services/nest-api.service';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject, catchError, firstValueFrom, Observable, of, switchMap, tap, throwError } from 'rxjs';

export type StatusLogin = 'off' | 'on' | 'expired'

@Injectable({
  providedIn: 'root'
})
export class AuthService {
    private readonly _isLoggedIn = new BehaviorSubject<boolean>(true);
    isLoggedIn$ = this._isLoggedIn.asObservable();

    private readonly _user = new BehaviorSubject<AuthContext | null>(null);
    user$ = this._user.asObservable();

    constructor(
      private readonly _nestApi: NestAPI,
      private readonly _router: Router,
      private _toast: ToastrService
    ) {
    }

    login(data: LoginData): Observable<AuthContext> {
      return this._nestApi.post('auth/login', data).pipe(
        switchMap(() => {
          return this.getAuthContext()
        }),
        tap((user: AuthContext) => {
          this.setUserLogged(user);
          this._router.navigateByUrl('/home');
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

    preLogin(data: PreLogin): Observable<UserLogged> {
      return this._nestApi.post('auth/preLogin', data)      
    }

    getAuthContext(): Observable<AuthContext> {
      if (this._user.value) {
        return of(this._user.value);
      }
    
      return this._nestApi.post<AuthContext>('auth/session').pipe(
        tap(userContext => this._user.next(userContext)),
        catchError((err: HttpErrorResponse) => {
          this._user.next(null); // limpa o usuário em caso de erro
          return throwError(() => err);
        })
      );
    }

    setStatusLogin(status: StatusLogin) {
      switch(status){
        case 'off': this._isLoggedIn.next(false);
          break
        case 'on': this._isLoggedIn.next(true);
          break
      }
    }

    setUserLogged(user: AuthContext | null) {
      this._user.next(user);
    }
}