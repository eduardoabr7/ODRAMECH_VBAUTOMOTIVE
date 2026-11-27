import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '@shared/services/auth.service';
import { ConnectionService } from '@shared/services/connection.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);
  private readonly _connection = inject(ConnectionService);

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    return this._authService.user$.pipe(
      take(1),
      map((user) => {
        const isLoggedIn = !!user;

        if (!isLoggedIn) {
          // se o servidor estava fora, guarda o destino para voltar a ele quando reconectar
          if (this._connection.isOffline) this._connection.pendingUrl = state.url;
          return this._router.createUrlTree(['/login']);
        }
        return true;
      })
    );
  }
}
