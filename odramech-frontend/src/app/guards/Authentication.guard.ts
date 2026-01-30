import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '@shared/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);

  canActivate(): Observable<boolean | UrlTree> {
    return this._authService.user$.pipe(
      take(1),
      map((user) => {
        const isLoggedIn = !!user;

        if (!isLoggedIn) {
          return this._router.createUrlTree(['/login']);
        }
        return true;
      })
    );
  }
}
