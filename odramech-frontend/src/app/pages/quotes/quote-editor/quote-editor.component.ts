import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { ToastrService } from 'ngx-toastr';
import { BsModalService } from 'ngx-bootstrap/modal';
import { map, Subscription } from 'rxjs';
import { BillingService } from '@shared/services/billing.service';
import { UserService } from '@shared/services/user.service';
import { VehicleService } from '@shared/services/vehicle.service';
import { SessionService } from '@shared/services/session.service';
import { AuthService } from '@shared/services/auth.service';
import { lineTotal, Quote, QUOTE_STATUS_LABEL, QuoteStatus, ServiceItem, ServiceItemInput } from '@shared/models/Billing';
import { UserList } from '@shared/models/UserList';
import { Vehicle } from '@shared/models/Vehicle';
import { ItemsEditorComponent } from '@shared/ui/items-editor.component';
import { InitialsPipe, PhonePipe, PlatePipe, RelativeTimePipe } from '@shared/ui/pipes';
import { CloseOnClickOutsideDirective } from '@shared/directives/close-onclick-outside.directive';
import { ModalCreateVehicleComponent } from '@shared/components/modals/vehicle-modals/modal-create-vehicle/modal-create-vehicle.component';

/** Tela única para criar (/quotes/new) e editar (/quotes/:id) orçamentos. */
@Component({
  selector: 'app-quote-editor',
  imports: [CommonModule, FormsModule, RouterModule, ItemsEditorComponent, InitialsPipe, PhonePipe, PlatePipe, RelativeTimePipe, CloseOnClickOutsideDirective],
  templateUrl: './quote-editor.component.html',
  styleUrl: './quote-editor.component.scss',
})
export class QuoteEditorComponent implements OnInit, OnDestroy {
  @ViewChild(ItemsEditorComponent) itemsEditor?: ItemsEditorComponent;

  readonly LABEL = QUOTE_STATUS_LABEL;
  readonly editableStatuses: QuoteStatus[] = ['RASCUNHO', 'ENVIADO', 'RECUSADO', 'EXPIRADO'];

  isNew = true;
  quote: Quote | null = null;
  loading = false;
  notFound = false;
  isStaff = false;
  establishmentName = '';

  // criação
  clientTerm = '';
  clientResults: UserList[] = [];
  showResults = false;
  searching = false;
  client: UserList | null = null;
  vehicles: Vehicle[] = [];
  vehicle: Vehicle | null = null;
  draftItems: ServiceItem[] = [];
  validUntil = this.defaultValidity();
  notes = '';
  saving = false;
  converting = false;
  savingItem = false;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private tempId = -1;

  private readonly subs = new Subscription();

  constructor(
    private readonly _route: ActivatedRoute,
    private readonly _router: Router,
    private readonly _title: Title,
    private readonly _billing: BillingService,
    private readonly _users: UserService,
    private readonly _vehicles: VehicleService,
    private readonly _toastr: ToastrService,
    private readonly _modal: BsModalService,
    private readonly _auth: AuthService,
    readonly session: SessionService,
  ) {}

  ngOnInit(): void {
    this.subs.add(this.session.isStaff$.subscribe(v => this.isStaff = v));
    this.subs.add(this._auth.user$.subscribe(ctx => this.establishmentName = ctx?.usercorp?.establishment?.name ?? ''));
    this.subs.add(this._route.paramMap.pipe(map(p => p.get('id'))).subscribe(id => {
      this.isNew = !id || id === 'new';
      if (!this.isNew) this.load(Number(id));
    }));
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  private defaultValidity(): string {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  }

  private load(id: number): void {
    this.loading = true;
    this._billing.getQuote(id).subscribe({
      next: q => this.setQuote(q),
      error: () => { this.loading = false; this.notFound = true; },
    });
  }

  private setQuote(q: Quote): void {
    this.quote = q;
    this.loading = false;
    this.notes = q.notes ?? '';
    this.validUntil = q.validUntil ? q.validUntil.slice(0, 10) : '';
    this._title.setTitle(`Orçamento #${q.numberQuote} · ${q.client.name} · Odramech`);
  }

  get locked(): boolean { return !!this.quote?.workOrder || !this.isStaff; }

  get expired(): boolean {
    return !!this.quote?.validUntil && new Date(this.quote.validUntil) < new Date() && this.quote.status !== 'APROVADO';
  }

  // ── Cliente / veículo (criação) ─────────────────────────
  onClientInput(): void {
    const term = this.clientTerm.trim();
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (term.length < 2) { this.showResults = false; return; }
    this.searching = true;
    this.showResults = true;
    this.searchTimer = setTimeout(() => {
      this._users.search(term).subscribe({
        next: r => { this.clientResults = r; this.searching = false; },
        error: () => { this.clientResults = []; this.searching = false; },
      });
    }, 300);
  }

  pickClient(c: UserList): void {
    this.client = c;
    this.showResults = false;
    this.clientTerm = '';
    this.vehicle = null;
    this._vehicles.getByUser(c.id).subscribe(v => {
      this.vehicles = v;
      if (v.length === 1) this.vehicle = v[0];
    });
  }

  clearClient(): void { this.client = null; this.vehicles = []; this.vehicle = null; }

  newVehicle(): void {
    if (!this.client) return;
    const ref = this._modal.show(ModalCreateVehicleComponent, {
      initialState: { title: 'Novo veículo', userId: this.client.id, clientName: this.client.name },
      class: 'modal-lg',
    });
    ref.content?.vehicleCreated.subscribe((v: Vehicle) => {
      if (!this.vehicles.some(x => x.id === v.id)) this.vehicles = [...this.vehicles, v];
      this.vehicle = v;
    });
  }

  // ── Itens ────────────────────────────────────────────────
  get items(): ServiceItem[] { return this.quote ? this.quote.items : this.draftItems; }

  addItem(input: ServiceItemInput): void {
    if (this.isNew) {
      const discount = input.discount ?? 0;
      this.draftItems = [...this.draftItems, { ...input, discount, id: this.tempId--, total: lineTotal(input), createdAt: new Date().toISOString() }];
      this.itemsEditor?.reset();
      return;
    }
    if (!this.quote) return;
    this.savingItem = true;
    this._billing.addQuoteItem(this.quote.id, input).subscribe({
      next: q => { this.setQuote(q); this.savingItem = false; this.itemsEditor?.reset(); },
      error: err => { this.savingItem = false; this._toastr.error(err?.error?.message ?? 'Não foi possível adicionar o item.'); },
    });
  }

  removeItem(item: ServiceItem): void {
    if (this.isNew) { this.draftItems = this.draftItems.filter(i => i.id !== item.id); return; }
    this._billing.deleteItem(item.id).subscribe({
      next: () => this.quote && this.setQuote({ ...this.quote, items: this.quote.items.filter(i => i.id !== item.id), total: this.quote.total - item.total }),
      error: err => this._toastr.error(err?.error?.message ?? 'Não foi possível remover o item.'),
    });
  }

  get draftTotal(): number { return Math.round(this.items.reduce((a, i) => a + i.total, 0) * 100) / 100; }

  // ── Salvar / status / converter ─────────────────────────
  create(): void {
    if (!this.client || !this.vehicle || this.saving) return;
    if (!this.draftItems.length) { this._toastr.warning('Adicione ao menos uma peça ou serviço.'); return; }
    this.saving = true;
    this._billing.createQuote({
      clientId: this.client.id,
      vehicleId: this.vehicle.id,
      validUntil: this.validUntil ? new Date(this.validUntil + 'T23:59:59').toISOString() : undefined,
      notes: this.notes.trim() || undefined,
      items: this.draftItems.map(({ kind, description, quantity, unitPrice, discount }) => ({ kind, description, quantity, unitPrice, discount })),
    }).subscribe({
      next: q => {
        this.saving = false;
        this._toastr.success(`Orçamento #${q.numberQuote} criado.`);
        this._router.navigate(['/quotes', q.id], { replaceUrl: true });
      },
      error: err => { this.saving = false; this._toastr.error(err?.error?.message ?? 'Não foi possível criar o orçamento.'); },
    });
  }

  saveMeta(): void {
    if (!this.quote || this.locked) return;
    this._billing.updateQuote(this.quote.id, {
      notes: this.notes.trim() || null,
      validUntil: this.validUntil ? new Date(this.validUntil + 'T23:59:59').toISOString() : null,
    }).subscribe({
      next: q => { this.setQuote(q); this._toastr.success('Orçamento atualizado.'); },
      error: err => this._toastr.error(err?.error?.message ?? 'Não foi possível salvar.'),
    });
  }

  setStatus(status: QuoteStatus): void {
    if (!this.quote || this.locked || this.quote.status === status) return;
    this._billing.updateQuote(this.quote.id, { status }).subscribe({
      next: q => { this.setQuote(q); this._toastr.success(`Marcado como ${QUOTE_STATUS_LABEL[status].toLowerCase()}.`); },
      error: err => this._toastr.error(err?.error?.message ?? 'Não foi possível alterar o status.'),
    });
  }

  convert(): void {
    if (!this.quote || this.locked || this.converting) return;
    if (!this.quote.items.length) { this._toastr.warning('O orçamento não tem itens.'); return; }
    if (!confirm(`Aprovar o orçamento #${this.quote.numberQuote} e abrir a OS com estes itens?`)) return;
    this.converting = true;
    this._billing.convertQuote(this.quote.id).subscribe({
      next: r => {
        this.converting = false;
        this._toastr.success(`OS #${r.numberOs} aberta a partir do orçamento.`, 'Orçamento aprovado');
        this._router.navigate(['/orders', r.workOrderId]);
      },
      error: err => { this.converting = false; this._toastr.error(err?.error?.message ?? 'Não foi possível converter.'); },
    });
  }

  print(): void { window.print(); }
}
