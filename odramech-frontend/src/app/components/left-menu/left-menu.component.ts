import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

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
  @Output() estadoMenuChange = new EventEmitter<boolean>();

  urlPhotoUser: string | null = null;
  isCollapsed = true;

  buttons: BotoesMenuLateral[] = [
    { nome: 'Home', fontAwesomeIcon: 'fa-solid fa-house' },
    { nome: 'Serviços', fontAwesomeIcon: 'fa-solid fa-wrench' },
    { nome: 'Meus veículos', fontAwesomeIcon: 'fa-solid fa-car-side' },
    { nome: 'Faturamento', fontAwesomeIcon: 'fa-solid fa-file' },
    { nome: 'Notificações', fontAwesomeIcon: 'fa-solid fa-envelope' }
  ]

  ngOnInit(): void {
    this.getUserPhotoURL()
    console.log(this.urlPhotoUser)
  }

  getUserPhotoURL(): void {
    this.urlPhotoUser = '../../../assets/remover_foto.jpeg'
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.estadoMenuChange.emit(!this.isCollapsed);
  }

  // aqui vai ter uma função pra verificar se o paciente tem foto de perfil, por enquanto vai ficar como false
  // ------------------------------------------------------------------------------------- //

}
