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
export class ClientsComponent implements OnInit {

  constructor(
    private readonly _bsModalService: BsModalService,
    private readonly _userCoporationService: UserCorporationService,
    private readonly _toastr: ToastrService
  ) {}

  establishments: any[];
  users: User[] = [];
  admins: User[] = [];
  workers: User[] = [];
  selectedEstablishmentId: number;

  hasSelectedClient = false;
  searchQuery = '';                          // ← novo: controla o input de busca

  // ── Getters ──────────────────────────────────────────────

  get selectedCount(): number {             // ← novo: qtd de selecionados p/ badge
    return this.users.filter(u => u.selected).length;
  }

  get filteredUsers(): User[] {             // ← novo: filtra a lista pelo searchQuery
    const q = this.searchQuery.toLowerCase();
    if (!q) return this.users;
    return this.users.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.principalPhone?.toLowerCase().includes(q)
    );
  }

  // ── Lifecycle ─────────────────────────────────────────────

  ngOnInit(): void {
    this._userCoporationService.getEstablishments().subscribe({
      next: (value) => {
        this.establishments = value.map(element => element.establishment);
        this.selectedEstablishmentId = this.establishments[0]?.id;
        this.loadUsersByEstablishment(this.selectedEstablishmentId);
      },
      error: (err) => {
        if (err.status != 401)
          this._toastr.warning('Ocorreu um erro ao buscar a lista de estabelecimentos', 'Atenção');
      }
    });
  }

  // ── Methods ───────────────────────────────────────────────

  loadUsersByEstablishment(idEstablishment: number) {
    if (!idEstablishment) {
      this._toastr.warning('Ocorreu um erro ao buscar a lista de clientes', 'Atenção');
      console.error('Não foi informado id estabelecimento para busca dos usuários');
      return;
    }

    const data = { idEstab: idEstablishment };

    this._userCoporationService.getUsersByEstablishments(data).subscribe({
      next: (value) => {
        const grouped = value.reduce((acc, user) => {
          acc[user.role] = acc[user.role] || [];
          acc[user.role].push(user.user);
          return acc;
        }, {} as Record<string, User[]>);

        this.users   = grouped[RoleEnum.USER]   || [];
        this.admins  = grouped[RoleEnum.ADMIN]  || [];
        this.workers = grouped[RoleEnum.WORKER] || [];
      }
    });
  }

  toggleUserSelection(user: User): void {
    user.selected = !user.selected;
    this.updateSelectedClientStatus();
  }

  updateSelectedClientStatus(): void {
    this.hasSelectedClient = this.users.some(user => user.selected);
  }

  openModalCreateUser() {
    this._bsModalService.show(ModalCreateUserComponent, {
      initialState: { title: 'Novo Cliente' },
      class: 'modal-lg'
    });
  }

}