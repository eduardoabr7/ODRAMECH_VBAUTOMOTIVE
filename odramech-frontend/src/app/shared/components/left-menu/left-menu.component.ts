import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '@shared/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { UserLogged } from '@shared/models/UserLogged';
import { Subscription } from 'rxjs';
import { AuthContext } from '@shared/models/AuthContext';
interface BotoesMenuLateral{
  nome: string,
  icon: string,
  route?: string
}

@Component({
  selector: 'app-left-menu',
  imports: [CommonModule],
  templateUrl: './left-menu.component.html',
  styleUrl: './left-menu.component.scss',
})
export class LeftMenuComponent implements OnInit {

  constructor(
    private readonly _authService : AuthService,
    private readonly _router: Router
  ) {

  }

  @Output() estadoMenuChange = new EventEmitter<boolean>();
  @Input() isCollapsed = true;

  authContext: AuthContext;
  corpLogged = null;
  urlPhotoUser: string | null = null;

  private userSubscription: Subscription | null = null;

  buttons: BotoesMenuLateral[] = [
    { nome: 'Home', icon: 'fa-solid fa-house' },
    { nome: 'Serviços', icon: 'fa-solid fa-wrench' },
    { nome: 'Meus veículos', icon: 'fa-solid fa-car-side' },
    { nome: 'Faturamento', icon: 'fa-solid fa-file' },
    { nome: 'Notificações', icon: 'fa-solid fa-envelope' },
    { nome: 'Clientes', icon: 'fa-solid fa-users', route: '/clients' }
  ]

  ngOnInit(): void {
    this.userSubscription = this._authService.user$.subscribe(authCtx => {
      this.authContext = authCtx;
      this.corpLogged = authCtx ? authCtx.usercorp : null

      this.getUserPhotoURL();
    });
  }

  getUserPhotoURL(): void {
    this.urlPhotoUser = '../../../assets/remover_foto.jpeg'
  }

  logout() {
    this._authService.logout().subscribe({
    });
  }

  navigateUrl(optionSelected: BotoesMenuLateral) {
    this._router.navigateByUrl(optionSelected.route)
  }

  navigateToSettings() {
    this._router.navigateByUrl('/settings')
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.estadoMenuChange.emit(!this.isCollapsed);
  }

  // aqui vai ter uma função pra verificar se o paciente tem foto de perfil, por enquanto vai ficar como false
  // ------------------------------------------------------------------------------------- //

}
