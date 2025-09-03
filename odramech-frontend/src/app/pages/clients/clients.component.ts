import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

interface User {
  id: number;
  name: string;
  email: string;
  selected: boolean;
}

@Component({
  selector: 'app-clients',
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss'
})
export class ClientsComponent {

  hasSelectedClient = false;


  establishments: [
    {
      name: 'VB-Automotive - Porto Alegre'
    },
    {
      name: 'VB-Automotive - Alvorada'
    }
  ]


  users : User[] = [
    { id: 1, name: 'João Silva', email: 'joaosilva@gmail.com', selected: false },
    { id: 2, name: 'Maria Oliveira', email: 'mariaoliveira@gmail.com', selected: false },
    { id: 3, name: 'Eduardo Abreu', email: 'eduardoabreu@gmail.com', selected: false },
    { id: 1, name: 'João Silva', email: 'joaosilva@gmail.com', selected: false },
    { id: 2, name: 'Maria Oliveira', email: 'mariaoliveira@gmail.com', selected: false },
    { id: 3, name: 'Eduardo Abreu', email: 'eduardoabreu@gmail.com', selected: false },
    { id: 1, name: 'João Silva', email: 'joaosilva@gmail.com', selected: false },
    { id: 2, name: 'Maria Oliveira', email: 'mariaoliveira@gmail.com', selected: false },
    { id: 3, name: 'Eduardo Abreu', email: 'eduardoabreu@gmail.com', selected: false },
    { id: 1, name: 'João Silva', email: 'joaosilva@gmail.com', selected: false },
    { id: 2, name: 'Maria Oliveira', email: 'mariaoliveira@gmail.com', selected: false },
    { id: 3, name: 'Eduardo Abreu', email: 'eduardoabreu@gmail.com', selected: false },
    { id: 1, name: 'João Silva', email: 'joaosilva@gmail.com', selected: false },
    { id: 2, name: 'Maria Oliveira', email: 'mariaoliveira@gmail.com', selected: false },
    { id: 3, name: 'Eduardo Abreu', email: 'eduardoabreu@gmail.com', selected: false },
    { id: 1, name: 'João Silva', email: 'joaosilva@gmail.com', selected: false },
    { id: 2, name: 'Maria Oliveira', email: 'mariaoliveira@gmail.com', selected: false },
    { id: 3, name: 'Eduardo Abreu', email: 'eduardoabreu@gmail.com', selected: false },
    { id: 1, name: 'João Silva', email: 'joaosilva@gmail.com', selected: false },
    { id: 2, name: 'Maria Oliveira', email: 'mariaoliveira@gmail.com', selected: false },
    { id: 3, name: 'Eduardo Abreu', email: 'eduardoabreu@gmail.com', selected: false },
  ];

  toggleUserSelection(user: User): void {
    user.selected = !user.selected;
    this.updateSelectedClientStatus();
  }

  updateSelectedClientStatus(): void {
    this.hasSelectedClient = this.users.some(user => user.selected);
  }

}
