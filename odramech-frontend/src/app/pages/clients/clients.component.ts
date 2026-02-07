import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ModalCreateUserComponent } from '@shared/components/modals/modal-create-user/modal-create-user.component';
import { RoleEnum } from '@shared/enums/role.enum';
import { UserCorporationService } from '@shared/services/user-corporation.service';
import { BsModalService } from 'ngx-bootstrap/modal';
import { ToastrService } from 'ngx-toastr';

interface User {
  id: number;
  name: string;
  email: string;
  principalPhone: string;
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
    private readonly _userCoporationService: UserCorporationService,
    private readonly _toastr: ToastrService
  ){}

  establishments
  users: User[]
  admins: User[]
  workers: User[]


  ngOnInit(): void {
    this._userCoporationService.getEstablishments().subscribe({
      next: (value) => {
        this.establishments = value.map(element => element.establishment);
        this.loadUsersByEstablishment(this.establishments[0].id)
      },
      error: (err) => {
        if(err.status != 401)
        this._toastr.warning('Ocorreu um erro ao buscar a lista de estabelecimentos', 'Atenção');
      }
    })
  }

  loadUsersByEstablishment(idEstablishment: number) {

    if(!idEstablishment) {
      this._toastr.warning('Ocorreu um erro ao buscar a lista de clientes', 'Atenção');
      console.error('Não foi informado id estabelecimento para busca dos usuários')
      return
    }

    const data = {
      idEstab: idEstablishment
    }

    this._userCoporationService.getUsersByEstablishments(data).subscribe({
      next: (value) => {
        const allUsersReturned = value
        
        const grouped = allUsersReturned.reduce((acc, user) => {
          acc[user.role] = acc[user.role] || []
          acc[user.role].push(user.user)
          return acc
        }, {} as Record<string, User[]>)

        const admins = grouped[RoleEnum.ADMIN] || []
        const users = grouped[RoleEnum.USER] || []
        const workers = grouped[RoleEnum.WORKER] || []

        this.users = users
        this.admins = admins
        this.workers = workers
      }
    })
    
  }

  hasSelectedClient = false;

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
