import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BaseModalComponent } from '../../base-modal.component';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { ToastrService } from 'ngx-toastr';
import { finalize, tap } from 'rxjs';
import { AddressCreate } from '@shared/models/AddressCreate';
import { UserCorporationService } from '@shared/services/user-corporation.service';
import { Role } from '@shared/models/UserCorporation';

interface Establishment {
  id: number;
  name: string;
  email?: string;
  phone: string;
  cnpj: string;
  logoUrl?: string;
  role: Role;
  address?: AddressCreate;
}

const AVATAR_COLORS = [
  '#2563eb', '#16a34a', '#7c3aed',
  '#dc2626', '#d97706', '#0891b2',
  '#be185d', '#059669',
];

const ROLE_CONFIG: Record<Role, { label: string; cssClass: string }> = {
  ADMIN:     { label: 'Admin',          cssClass: 'bg-danger-subtle text-danger'   },
  USER:      { label: 'Usuário',        cssClass: 'bg-primary-subtle text-primary' },
  WORKER:    { label: 'Funcionário',    cssClass: 'bg-warning-subtle text-warning' },
  SUPERUSER: { label: 'Super Usuário',  cssClass: 'bg-warning-subtle text-secondary' }
};

@Component({
  selector: 'app-modal-view-establishments',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './modal-view-establishments.component.html',
  styleUrls: ['./modal-view-establishments.component.scss']
})
export class ModalViewEstablishmentsComponent extends BaseModalComponent implements OnInit {

  constructor(
    bsModalRef: BsModalRef,
    private readonly _modalService: BsModalService,
    private readonly _toastr: ToastrService,
    private readonly _userCorpService: UserCorporationService
  ) {
    super(bsModalRef);
  }

  loading = false;
  searchQuery = '';
  establishments: Establishment[] = [];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;

    this._userCorpService.getEstablishmentsOnAdmin()
      .pipe(
        tap((data) => {
          this.establishments = data;
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        error: (err) => {
          this._toastr.error('Erro ao carregar estabelecimentos');
          console.warn(err);
        }
      });
  }

  get filteredEstablishments(): Establishment[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.establishments;
    return this.establishments.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.cnpj.includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.address?.city.toLowerCase().includes(q)
    );
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  }

  getAvatarColor(name: string): string {
    const index = name.charCodeAt(0) % AVATAR_COLORS.length;
    return AVATAR_COLORS[index];
  }

  getRoleLabel(role: Role): string {
    return ROLE_CONFIG[role]?.label ?? role;
  }

  getRoleBadgeClass(role: Role): string {
    return ROLE_CONFIG[role]?.cssClass ?? 'bg-secondary-subtle text-secondary';
  }

  openCreate(): void {
    this._toastr.info('Em breve: criação de estabelecimento.');
  }

  openEdit(est: Establishment): void {
    this._toastr.info(`Editar: ${est.name}`);
  }

  confirmDelete(est: Establishment): void {
    this._toastr.warning(`Excluir: ${est.name}`);
  }
}