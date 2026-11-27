import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BsModalService } from 'ngx-bootstrap/modal';
import { ToastrService } from 'ngx-toastr';
import { ModalCreateUserComponent } from '@shared/components/modals/user-modals/modal-create-user/modal-create-user.component';
import { RoleEnum } from '@shared/enums/role.enum';
import { UserCorporationService } from '@shared/services/user-corporation.service';
import { InitialsPipe, PhonePipe } from '@shared/ui/pipes';

interface ClientRow {
  id: number;
  name: string;
  email: string | null;
  principalPhone: string;
}

@Component({
  selector: 'app-clients',
  imports: [CommonModule, FormsModule, RouterModule, InitialsPipe, PhonePipe],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss'
})
export class ClientsComponent implements OnInit {

  constructor(
    private readonly _bsModalService: BsModalService,
    private readonly _userCorporationService: UserCorporationService,
    private readonly _toastr: ToastrService,
    private readonly _router: Router,
  ) {}

  establishments: any[] = [];
  selectedEstablishmentId: number | null = null;

  users: ClientRow[] = [];
  staffCount = 0;
  loading = true;
  searchQuery = '';

  get filteredUsers(): ClientRow[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.users;
    const digits = q.replace(/\D/g, '');
    return this.users.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      (digits && u.principalPhone?.replace(/\D/g, '').includes(digits))
    );
  }

  ngOnInit(): void {
    this._userCorporationService.getEstablishmentsOnAdminOrWorker().subscribe({
      next: (value) => {
        this.establishments = value ?? [];
        this.selectedEstablishmentId = this.establishments[0]?.id ?? null;
        if (this.selectedEstablishmentId) this.loadUsersByEstablishment(this.selectedEstablishmentId);
        else this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        if (err.status != 401)
          this._toastr.warning('Não foi possível carregar os estabelecimentos.', 'Atenção');
      }
    });
  }

  loadUsersByEstablishment(idEstablishment: number | string | null) {
    if (!idEstablishment) return;
    this.loading = true;

    this._userCorporationService.getUsersByEstablishments({ idEstab: Number(idEstablishment) }).subscribe({
      next: (value: { role: RoleEnum; user: ClientRow }[]) => {
        this.users = value.filter(v => v.role === RoleEnum.USER).map(v => v.user)
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        this.staffCount = value.length - this.users.length;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this._toastr.warning('Não foi possível carregar os clientes.', 'Atenção');
      }
    });
  }

  open(user: ClientRow): void {
    this._router.navigate(['/clients', user.id]);
  }

  openModalCreateUser() {
    const modalRef = this._bsModalService.show(ModalCreateUserComponent, {
      initialState: { title: 'Novo cliente' },
      class: 'modal-lg'
    });

    modalRef.content.onClose.subscribe((result: any) => {
      if (!result) return;
      if (this.selectedEstablishmentId) this.loadUsersByEstablishment(this.selectedEstablishmentId);
    });
  }
}
