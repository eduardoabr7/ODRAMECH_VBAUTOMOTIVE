import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { UndoBarComponent } from './core/undo/undo-bar.component';
import { ConnectionBannerComponent } from '@shared/components/connection-banner/connection-banner.component';
import { ConnectionService } from '@shared/services/connection.service';
import { AuthService } from '@shared/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConnectionBannerComponent, UndoBarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'frontend';
  private readonly subs = new Subscription();

  constructor(
    private readonly _connection: ConnectionService,
    private readonly _auth: AuthService,
    private readonly _router: Router,
    private readonly _toastr: ToastrService,
  ) {}

  /**
   * Ao reconectar: revalida a sessão (o token pode ter expirado enquanto estava fora).
   * Se o usuário estava na tela de login só porque o servidor caiu, devolve para onde ia.
   * O LayoutComponent cuida de recarregar a página atual.
   */
  ngOnInit(): void {
    this.subs.add(this._connection.reconnected$.subscribe(() => {
      this._auth.refreshAuthContext().subscribe({
        next: () => {
          const onLogin = this._router.url.startsWith('/login');
          if (onLogin) {
            const target = this._connection.pendingUrl || '/home';
            this._connection.pendingUrl = null;
            this._router.navigateByUrl(target);
          }
        },
        error: () => {
          // sem sessão válida: segue fluxo normal (o interceptor de sessão expirada leva ao login)
          this._connection.pendingUrl = null;
        },
      });
    }));
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }
}
