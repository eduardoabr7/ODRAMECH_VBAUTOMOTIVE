import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { LoginData } from '@shared/models/LoginData';
import { UserLogged } from '@shared/models/UserLogged';
import { NestAPI } from '@shared/services/nest-api.service';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject, catchError, firstValueFrom, Observable, tap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
    // BehaviorSubject para o estado de login
    private readonly _isLoggedIn = new BehaviorSubject<boolean>(!!sessionStorage.getItem('user'));
    // observable público para o AuthGuard e outros componentes
    isLoggedIn$ = this._isLoggedIn.asObservable();

    constructor(
      private readonly _nestApi: NestAPI,
      private readonly _router: Router,
      private _toast: ToastrService
    ) {
      window.addEventListener('storage', (event: StorageEvent) => {
        if(event.key === 'user' && !event.newValue){
          this._isLoggedIn.next(false);
          this.logout().subscribe();
        }
      });
    }

    login(data: LoginData): Observable<any> {
      return this._nestApi.post('auth/login', data).pipe(
        tap(() => this._isLoggedIn.next(true))
      );
    }

    logout(): Observable<any> {
      return this._nestApi.post('auth/logout', {}).pipe(
        tap(() => {
          sessionStorage.removeItem('user');
          this._isLoggedIn.next(false);
          this._router.navigateByUrl('/login');
          this._toast.info('Sessão encerrada');
        }),
        catchError((err: HttpErrorResponse) => {
          this._toast.error('Não foi possível encerrar sessão: ' + err.message);
          return throwError(() => err); // propaga o erro para que o componente possa reagir, se necessário
        })
      );
    }

    getUserLogged(): Observable<UserLogged> {
      return this._nestApi.get<UserLogged>('auth/user');
    }
}