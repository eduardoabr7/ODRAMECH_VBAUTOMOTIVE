import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { BsModalService } from 'ngx-bootstrap/modal';
import { ToastrService } from 'ngx-toastr';
import { NgxMaskDirective } from 'ngx-mask';
import { combineLatest, map, Subscription, switchMap, take, tap } from 'rxjs';
import { UserService } from '@shared/services/user.service';
import { AuthService } from '@shared/services/auth.service';
import { UserCorporationService } from '@shared/services/user-corporation.service';
import { WorkOrderService } from '@shared/services/work-orders.service';
import { ZipCodeService } from '@shared/services/zipcode.service';
import { UserDetail } from '@shared/models/UserList';
import { WorkOrder } from '@shared/models/WorkOrder';
import { Vehicle } from '@shared/models/Vehicle';
import { GenderEnum } from '@shared/enums/gender.enum';
import { ModalCreateVehicleComponent } from '@shared/components/modals/vehicle-modals/modal-create-vehicle/modal-create-vehicle.component';
import { StatusBadgeComponent } from '@shared/ui/status-badge.component';
import { InitialsPipe, PhonePipe, PlatePipe, RelativeTimePipe, RoleLabelPipe } from '@shared/ui/pipes';

interface EditForm {
  name: string;
  gender: GenderEnum;
  email: string;
  principalPhone: string;
  secondaryPhone: string;
  active: boolean;
  hasAddress: boolean;
  address: {
    zipCode: string; street: string; number: string; complement: string;
    neighborhood: string; city: string; district: string; country: string;
  };
}

@Component({
  selector: 'app-client-detail',
  imports: [CommonModule, FormsModule, RouterModule, NgxMaskDirective, StatusBadgeComponent, InitialsPipe, PhonePipe, PlatePipe, RelativeTimePipe, RoleLabelPipe],
  templateUrl: './client-detail.component.html',
  styleUrl: './client-detail.component.scss',
})
export class ClientDetailComponent implements OnInit, OnDestroy {

  readonly GenderEnum = GenderEnum;

  user: UserDetail | null = null;
  orders: WorkOrder[] = [];
  ordersTotal = 0;
  loading = true;
  notFound = false;

  editing = false;
  saving = false;
  loadingCep = false;
  form: EditForm | null = null;

  /** estabelecimento da ficha quando não é o da sessão (veio da lista de clientes) */
  establishmentId: number | null = null;
  establishmentName: string | null = null;

  private readonly subs = new Subscription();

  constructor(
    private readonly _route: ActivatedRoute,
    private readonly _router: Router,
    private readonly _title: Title,
    private readonly _users: UserService,
    private readonly _workOrders: WorkOrderService,
    private readonly _zip: ZipCodeService,
    private readonly _modal: BsModalService,
    private readonly _toastr: ToastrService,
    private readonly _auth: AuthService,
    private readonly _userCorp: UserCorporationService,
  ) {}

  ngOnInit(): void {
    const sessionEstab$ = this._auth.user$.pipe(map(ctx => ctx?.usercorp?.establishment?.id ?? null), take(1));

    this.subs.add(combineLatest([this._route.paramMap, this._route.queryParamMap, sessionEstab$]).pipe(
      map(([p, q, sessionEstab]) => {
        const estab = Number(q.get('estab')) || null;
        return { id: Number(p.get('id')), estab: estab && estab !== sessionEstab ? estab : null };
      }),
      tap(({ estab }) => {
        this.loading = true; this.notFound = false; this.editing = false;
        this.establishmentId = estab;
        this.loadEstablishmentName();
      }),
      switchMap(({ id, estab }) => this._users.getById(id, estab)),
    ).subscribe({
      next: user => {
        this.user = user;
        this.loading = false;
        this._title.setTitle(`${user.name} · Clientes · Odramech`);
        this.loadOrders();
      },
      error: () => { this.loading = false; this.notFound = true; },
    }));
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  private loadEstablishmentName(): void {
    this.establishmentName = null;
    if (!this.establishmentId) return;
    this._userCorp.getEstablishmentsOnAdminOrWorker().subscribe({
      next: (list: { id: number; name: string }[]) => this.establishmentName = list?.find(e => e.id === this.establishmentId)?.name ?? null,
      error: () => this.establishmentName = null,
    });
  }

  /** a ficha é de outro estabelecimento (as OS de lá só abrem entrando nele) */
  get isForeign(): boolean { return !!this.establishmentId; }

  get backQueryParams(): Record<string, number> {
    return this.establishmentId ? { estab: this.establishmentId } : {};
  }

  private loadOrders(): void {
    if (!this.user) return;
    this._workOrders.list({ clientId: this.user.id, pageSize: 50, establishmentId: this.establishmentId }).subscribe({
      next: page => { this.orders = page.items; this.ordersTotal = page.total; },
      error: () => this.orders = [],
    });
  }

  get openOrders(): number {
    return this.orders.filter(o => o.status !== 'FINALIZADA' && o.status !== 'CANCELADA').length;
  }

  // ── Edição ───────────────────────────────────────────────
  startEdit(): void {
    if (!this.user) return;
    const a = this.user.address;
    this.form = {
      name: this.user.name,
      gender: this.user.gender,
      email: this.user.email ?? '',
      principalPhone: this.user.principalPhone ?? '',
      secondaryPhone: this.user.secondaryPhone ?? '',
      active: this.user.active !== false,
      hasAddress: !!a,
      address: {
        zipCode: a?.zipCode ?? '', street: a?.street ?? '', number: a?.number ?? '',
        complement: a?.complement ?? '', neighborhood: a?.neighborhood ?? '',
        city: a?.city ?? '', district: a?.district ?? '', country: a?.country ?? 'Brasil',
      },
    };
    this.editing = true;
  }

  cancelEdit(): void { this.editing = false; this.form = null; }

  lookupCep(): void {
    const cep = this.form?.address.zipCode?.replace(/\D/g, '');
    if (!this.form || !cep || cep.length !== 8) return;
    this.loadingCep = true;
    this._zip.lookup(cep).subscribe({
      next: v => {
        const a = this.form!.address;
        a.street = v.street || a.street;
        a.neighborhood = v.neighborhood || a.neighborhood;
        a.city = v.city || a.city;
        a.district = v.district || a.district;
        this.loadingCep = false;
      },
      error: () => { this.loadingCep = false; this._toastr.info('CEP não encontrado.'); },
    });
  }

  save(): void {
    if (!this.user || !this.form || this.saving) return;
    const f = this.form;

    if (!f.name.trim() || !f.principalPhone.trim()) {
      this._toastr.warning('Nome e telefone principal são obrigatórios.');
      return;
    }

    const a = f.address;
    const addressComplete = a.zipCode && a.street && a.number && a.neighborhood && a.city && a.district && a.country;
    if (f.hasAddress && !addressComplete) {
      this._toastr.warning('Preencha o endereço completo ou desmarque a opção.');
      return;
    }

    this.saving = true;
    this._users.update(this.user.id, {
      name: f.name.trim(),
      gender: f.gender,
      email: f.email.trim() || undefined,
      principalPhone: f.principalPhone,
      secondaryPhone: f.secondaryPhone || undefined,
      ...(f.active !== (this.user.active !== false) && { active: f.active }),
      ...(f.hasAddress && {
        address: { ...a, complement: a.complement || undefined },
      }),
    }, this.establishmentId).subscribe({
      next: user => {
        this.user = user;
        this.saving = false;
        this.editing = false;
        this._toastr.success('Cadastro atualizado.');
      },
      error: err => {
        this.saving = false;
        const msg = err?.error?.errors?.[0]?.constraints
          ? 'Confira os campos: ' + err.error.errors.map((e: any) => e.property).join(', ')
          : err?.error?.message ?? 'Não foi possível salvar.';
        this._toastr.error(msg);
      },
    });
  }

  // ── Veículos ─────────────────────────────────────────────
  addVehicle(): void {
    if (!this.user) return;
    const ref = this._modal.show(ModalCreateVehicleComponent, {
      initialState: { title: 'Novo veículo', userId: this.user.id, clientName: this.user.name, establishmentId: this.establishmentId },
      class: 'modal-lg',
    });
    ref.content?.vehicleCreated.subscribe((v: Vehicle) => {
      if (this.user && !this.user.vehicles.some(x => x.id === v.id)) {
        this.user = { ...this.user, vehicles: [...this.user.vehicles, v] };
      }
    });
  }

  openOrder(wo: WorkOrder): void {
    if (this.isForeign) {
      this._toastr.info(`Esta OS é de ${this.establishmentName ?? 'outro estabelecimento'}. Troque de estabelecimento para abri-la.`);
      return;
    }
    this._router.navigate(['/orders', wo.id]);
  }

  newOrder(): void { this._router.navigate(['/orders/new']); }

  get genderLabel(): string {
    return { M: 'Masculino', F: 'Feminino', O: 'Outro' }[this.user?.gender ?? ''] ?? '—';
  }
}
