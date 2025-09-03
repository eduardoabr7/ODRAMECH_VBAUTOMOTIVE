import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '@shared/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

interface BotoesMenuLateral{
  nome: string,
  fontAwesomeIcon: string,
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

  urlPhotoUser: string | null = null;

  buttons: BotoesMenuLateral[] = [
    { nome: 'Home', fontAwesomeIcon: 'fa-solid fa-house' },
    { nome: 'Serviços', fontAwesomeIcon: 'fa-solid fa-wrench' },
    { nome: 'Meus veículos', fontAwesomeIcon: 'fa-solid fa-car-side' },
    { nome: 'Faturamento', fontAwesomeIcon: 'fa-solid fa-file' },
    { nome: 'Notificações', fontAwesomeIcon: 'fa-solid fa-envelope' },
    { nome: 'Clientes', fontAwesomeIcon: 'fa-solid fa-users', route: '/clients' }
  ]

  ngOnInit(): void {
  }

  getUserPhotoURL(): void {
    this.urlPhotoUser = '../../../assets/remover_foto.jpeg'
  }

  logout() {
    this._authService.logout().subscribe({
      // Opcional: `complete` ou um `next`, caso precise alguma reação
      // complete: () => {
      //   console.log('Logout completado!');
      // }
    });
  }

  navigateUrl(optionSelected: BotoesMenuLateral) {
    this._router.navigateByUrl(optionSelected.route)
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.estadoMenuChange.emit(!this.isCollapsed);
  }

  // aqui vai ter uma função pra verificar se o paciente tem foto de perfil, por enquanto vai ficar como false
  // ------------------------------------------------------------------------------------- //

}
