import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ModalCreateUserComponent } from '@shared/components/modals/modal-create-user/modal-create-user.component';
import { UserCorporationService } from '@shared/services/user-corporation.service';
import { BsModalService } from 'ngx-bootstrap/modal';

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
export class ClientsComponent implements OnInit{

  constructor(
    private readonly _bsModalService: BsModalService,
    private readonly _userCoporationService: UserCorporationService
  ){}

  establishments


  ngOnInit(): void {
    this._userCoporationService.getEstablishments().subscribe({
      next: (value) => {
        this.establishments = value.map(element => element.establishment);
      }
    })
  }

  hasSelectedClient = false;

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

  openModalCreateUser(){
    const modalRef = this._bsModalService.show(
      ModalCreateUserComponent,
      {
        initialState: {
          title: 'Novo Cliente'
        },
        class: 'modal-lg'
      }
    );
  }

}
