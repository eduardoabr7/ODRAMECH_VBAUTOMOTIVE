import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '@shared/services/auth.service';
import { ToastrService } from 'ngx-toastr';

interface BotoesMenuLateral{
  nome: string,
  fontAwesomeIcon: string
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
    private readonly _toast : ToastrService
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
    { nome: 'Notificações', fontAwesomeIcon: 'fa-solid fa-envelope' }
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

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.estadoMenuChange.emit(!this.isCollapsed);
  }

  // aqui vai ter uma função pra verificar se o paciente tem foto de perfil, por enquanto vai ficar como false
  // ------------------------------------------------------------------------------------- //

}
