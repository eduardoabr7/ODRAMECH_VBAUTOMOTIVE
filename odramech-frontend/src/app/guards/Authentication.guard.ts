import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '@shared/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  // Injeta o serviço de autenticação e o router
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);

  canActivate(): Observable<boolean | UrlTree> {
    // Retorna o Observable do estado de login do AuthService
    return this._authService.isLoggedIn$.pipe(
      // Pega o primeiro valor emitido e completa.
      // Isso evita que o guard fique "escutando" para sempre.
      take(1),
      // Mapeia o valor booleano para uma decisão de navegação
      map((isLoggedIn: boolean) => {
        if (!isLoggedIn) {
          // Se o usuário não estiver logado, redireciona para a página de login
          // A forma reativa é retornar uma UrlTree.
          return this._router.createUrlTree(['/login']);
        }
        // Se estiver logado, permite o acesso.
        return true;
      })
    );
  }
}