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
import { KeyboardListDirective } from '@shared/directives/keyboard-list.directive';
import { ModalCreateVehicleComponent } from '@shared/components/modals/vehicle-modals/modal-create-vehicle/modal-create-vehicle.component';
import { SettingsService } from '@shared/services/settings.service';
import { QuoteDocument } from '@shared/models/Settings';
import { printHtml } from '../../../features/quote-document/print-html';

/** Tela única para criar (/quotes/new) e editar (/quotes/:id) orçamentos. */
@Component({
  selector: 'app-quote-editor',
  imports: [CommonModule, FormsModule, RouterModule, ItemsEditorComponent, InitialsPipe, PhonePipe, PlatePipe, RelativeTimePipe, CloseOnClickOutsideDirective, KeyboardListDirective],
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
  printing = false;
  /** janela de impressão fechada: pergunta se imprimiu de fato (o navegador não informa) */
  askPrinted = false;
  sendingEmail = false;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshTries = 0;
  /** configuração do documento (modelo, validade padrão, marcar enviado ao imprimir) */
  doc: QuoteDocument | null = null;
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
    private readonly _settings: SettingsService,
    readonly session: SessionService,
  ) {}

  ngOnInit(): void {
    this.subs.add(this.session.isStaff$.subscribe(v => {
      this.isStaff = v;
      if (v && !this.doc) this.loadDocumentSettings();
    }));
    this.subs.add(this._auth.user$.subscribe(ctx => this.establishmentName = ctx?.usercorp?.establishment?.name ?? ''));
    this.subs.add(this._route.paramMap.pipe(map(p => p.get('id'))).subscribe(id => {
      this.isNew = !id || id === 'new';
      if (!this.isNew) this.load(Number(id));
    }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
  }

  private defaultValidity(days = 15): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return localDate(d);
  }

  private loadDocumentSettings(): void {
    this._settings.getQuoteDocument().subscribe({
      next: doc => {
        // a validade do orçamento novo segue a configuração do estabelecimento
        const usingDefault = this.isNew && this.validUntil === this.defaultValidity();
        this.doc = doc;
        if (usingDefault) this.validUntil = this.defaultValidity(doc.settings.quoteValidityDays);
      },
      error: () => { /* sem configuração: imprime no modelo padrão */ },
    });
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
    // data local (a validade é salva às 23:59 do dia; em UTC isso já cai no dia seguinte)
    this.validUntil = q.validUntil ? localDate(new Date(q.validUntil)) : '';
    this._title.setTitle(`Orçamento #${q.numberQuote} · ${q.client.name} · Odramech`);
    this.watchPendingEmail();
  }

  // ── E-mail ao cliente ───────────────────────────────────
  get clientEmail(): string | null { return this.quote?.client.email || null; }
  get autoEmail(): boolean { return !!this.doc?.settings.autoEmailQuote; }
  /** a versão atual já foi enviada? (a mesma versão nunca é reenviada) */
  get emailUpToDate(): boolean { return !!this.quote?.emailSentAt && this.quote.emailSentVersion === this.quote.version; }
  /** já foi enviado antes e mudou depois → próximo envio é "atualização" */
  get emailOutdated(): boolean { return !!this.quote?.emailSentAt && this.quote.emailSentVersion !== this.quote.version; }
  get lastEmail() { return this.quote?.emails?.[0] ?? null; }
  get clientLink(): string | null {
    return this.quote?.publicToken && typeof location !== 'undefined' ? `${location.origin}/orcamento/${this.quote.publicToken}` : null;
  }

  sendEmail(): void {
    if (!this.quote || this.sendingEmail || this.emailUpToDate) return;
    if (!this.clientEmail) { this._toastr.warning('O cliente não tem e-mail cadastrado.'); return; }
    this.sendingEmail = true;
    this._billing.emailQuote(this.quote.id).subscribe({
      next: r => {
        this.sendingEmail = false;
        this.setQuote(r.quote);
        const what = r.result.kind === 'ATUALIZACAO' ? 'Atualização do orçamento' : 'Orçamento';
        if (r.result.status === 'SIMULADO') this._toastr.warning(`${what} gerado, mas o servidor está sem SMTP configurado — o e-mail não saiu (salvo em outbox).`, 'E-mail simulado');
        else this._toastr.success(`${what} enviado para ${r.result.to}.`);
      },
      error: err => { this.sendingEmail = false; this._toastr.error(err?.error?.message ?? 'Não foi possível enviar o e-mail.'); this.reload(); },
    });
  }

  async copyClientLink(): Promise<void> {
    if (!this.clientLink) return;
    try { await navigator.clipboard.writeText(this.clientLink); this._toastr.success('Link do cliente copiado.'); }
    catch { this._toastr.info(this.clientLink); }
  }

  private reload(): void {
    if (this.quote) this._billing.getQuote(this.quote.id).subscribe({ next: q => this.setQuote(q), error: () => undefined });
  }

  /** envio automático em andamento (logo após salvar): atualiza a tela quando sair */
  private watchPendingEmail(): void {
    if (this.refreshTimer) { clearTimeout(this.refreshTimer); this.refreshTimer = null; }
    const pending = this.quote?.emailPendingAt ? new Date(this.quote.emailPendingAt).getTime() : null;
    if (!pending || pending - Date.now() > 60_000) { this.refreshTries = 0; return; }
    if (this.refreshTries++ > 6) return;
    this.refreshTimer = setTimeout(() => this.reload(), 5_000);
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
      // recarrega: a remoção gera nova versão do orçamento (e talvez um envio agendado)
      next: () => this.reload(),
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

  /** Gera o documento (sem os campos de edição da tela) e abre a impressão / salvar PDF. */
  async print(): Promise<void> {
    if (!this.quote || this.printing) return;
    this.printing = true;
    try {
      const doc = this.doc ?? await new Promise<QuoteDocument>((resolve, reject) =>
        this._settings.getQuoteDocument().subscribe({ next: d => { this.doc = d; resolve(d); }, error: reject }));
      const html = await new Promise<string>((resolve, reject) =>
        this._settings.quoteDocumentHtml(this.quote!.id).subscribe({ next: resolve, error: reject }));
      await printHtml(html);
      this.afterPrint(doc);
    } catch {
      this._toastr.error('Não foi possível gerar o documento de impressão.');
    } finally {
      this.printing = false;
    }
  }

  /**
   * O navegador só avisa que a janela de impressão FECHOU — não se a pessoa imprimiu ou cancelou.
   * Por isso o status só muda depois que ela confirma que imprimiu.
   */
  private afterPrint(doc: QuoteDocument): void {
    if (!this.quote || !doc.settings.markQuoteSentOnPrint || this.quote.status !== 'RASCUNHO' || this.locked) return;
    this.askPrinted = true;
  }

  answerPrinted(printed: boolean): void {
    this.askPrinted = false;
    if (!printed || !this.quote) return;
    this._settings.markQuotePrinted(this.quote.id).subscribe({
      next: r => {
        if (!r.changed) return;
        this.setQuote(r.quote);
        this._toastr.success('Orçamento marcado como enviado.');
      },
      error: () => { /* status continua como estava */ },
    });
  }
}

/** yyyy-mm-dd no fuso do navegador (toISOString usaria UTC) */
function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
