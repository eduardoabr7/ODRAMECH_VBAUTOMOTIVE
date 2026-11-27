import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '@shared/services/auth.service';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BsModalService } from 'ngx-bootstrap/modal';
import { ToastrService } from 'ngx-toastr';
import { ModalCreateUserComponent } from '@shared/components/modals/user-modals/modal-create-user/modal-create-user.component';
import { RoleEnum } from '@shared/enums/role.enum';
import { UserCorporationService } from '@shared/services/user-corporation.service';
import { InitialsPipe, PhonePipe } from '@shared/ui/pipes';
import { ExportButtonComponent, ExportOption } from '../../features/export/export-button.component';

interface ClientRow {
  id: number;
  name: string;
  email: string | null;
  principalPhone: string;
}

@Component({
  selector: 'app-clients',
  imports: [CommonModule, FormsModule, RouterModule, InitialsPipe, PhonePipe, ExportButtonComponent],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss'
})
export class ClientsComponent implements OnInit {

  /** estabelecimento da sessão (a lista abre nele) */
  private readonly _ctx = toSignal(inject(AuthService).user$, { initialValue: null });
  private _authService_currentEstablishmentId(): number | null { return this._ctx()?.usercorp?.establishment?.id ?? null; }

  constructor(
    private readonly _bsModalService: BsModalService,
    private readonly _userCorporationService: UserCorporationService,
    private readonly _toastr: ToastrService,
    private readonly _router: Router,
    private readonly _route: ActivatedRoute,
  ) {}

  readonly exportOptions: ExportOption[] = [{
    kind: 'clients', label: 'Clientes',
    filters: () => ({
      search: this.searchQuery,
      establishmentId: this.selectedEstablishmentId !== this._authService_currentEstablishmentId() ? this.selectedEstablishmentId : null,
    }),
  }];

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
        // abre no estabelecimento da sessão (antes abria no primeiro da lista)
        // ?estab= vem da ficha do cliente (botão voltar) e mantém o estabelecimento escolhido
        const fromUrl = Number(this._route.snapshot.queryParamMap.get('estab')) || null;
        const current = this._authService_currentEstablishmentId();
        this.selectedEstablishmentId = this.establishments.find(e => e.id === fromUrl)?.id
          ?? this.establishments.find(e => e.id === current)?.id
          ?? this.establishments[0]?.id ?? null;
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

  /** a ficha abre no estabelecimento selecionado na lista (pode não ser o da sessão) */
  open(user: ClientRow): void {
    const estab = this.selectedEstablishmentId && this.selectedEstablishmentId !== this._authService_currentEstablishmentId()
      ? this.selectedEstablishmentId
      : null;
    this._router.navigate(['/clients', user.id], { queryParams: estab ? { estab } : {} });
  }

  get selectedEstablishmentName(): string | null {
    return this.establishments.find(e => e.id === this.selectedEstablishmentId)?.name ?? null;
  }

  openModalCreateUser() {
    const modalRef = this._bsModalService.show(ModalCreateUserComponent, {
      initialState: {
        title: this.selectedEstablishmentName ? `Novo cliente · ${this.selectedEstablishmentName}` : 'Novo cliente',
        // cadastra no estabelecimento que está selecionado na tela (não só no da sessão)
        establishmentId: this.selectedEstablishmentId ?? undefined,
      },
      class: 'modal-lg'
    });

    modalRef.content.onClose.subscribe((result: any) => {
      if (!result) return;
      if (this.selectedEstablishmentId) this.loadUsersByEstablishment(this.selectedEstablishmentId);
    });
  }
}
