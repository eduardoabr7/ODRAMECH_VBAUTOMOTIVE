import { Component, OnInit } from '@angular/core';
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

  botoes: BotoesMenuLateral[] = [
    { nome: 'Home', fontAwesomeIcon: 'fa-solid fa-house' },
    { nome: 'Serviços', fontAwesomeIcon: 'fa-solid fa-wrench' },
    { nome: 'Faturamento', fontAwesomeIcon: 'fa-solid fa-file' },
    { nome: 'Notificações', fontAwesomeIcon: 'fa-solid fa-envelope' }
  ]

  ngOnInit(): void {

  }

}
