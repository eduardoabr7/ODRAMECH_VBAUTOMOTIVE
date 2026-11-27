import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { filter, map, of, Subscription, switchMap, take } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { WorkOrderService } from '@shared/services/work-orders.service';
import { UserCorporationService } from '@shared/services/user-corporation.service';
import { SessionService } from '@shared/services/session.service';
import { AuthService } from '@shared/services/auth.service';
import { Appointment, WorkOrderDetail } from '@shared/models/WorkOrder';
import { UserList } from '@shared/models/UserList';
import { STATUS_LABEL, StatusOS } from '@shared/enums/status-os.enum';
import { AppointmentTypeEnum } from '@shared/enums/type-appointment.enum';
import { StatusBadgeComponent } from '@shared/ui/status-badge.component';
import { InitialsPipe, PhonePipe, PlatePipe, RelativeTimePipe } from '@shared/ui/pipes';
import { ItemsEditorComponent } from '@shared/ui/items-editor.component';
import { BillingService } from '@shared/services/billing.service';
import { PAYMENT_LABEL, PaymentMethod, ServiceItem, ServiceItemInput } from '@shared/models/Billing';
import { ArchiveAppointment } from '@shared/models/WorkOrder';
import { UndoService } from '../../../core/undo/undo.service';
import { MediaPickerComponent } from '@shared/media/media-picker.component';
import { ResizableImageComponent } from '@shared/media/resizable-image.component';
import { ImageLightboxComponent, LightboxImage } from '@shared/media/image-lightbox.component';

interface PickedFile {
  file: File;
  /** miniatura local (object URL) das imagens escolhidas */
  preview: string | null;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;

type TimelineItem =
  | { kind: 'event'; at: string; icon: string; text: string; who?: string }
  | { kind: 'note'; at: string; appt: Appointment };

@Component({
  selector: 'app-order-detail',
  imports: [
    CommonModule, FormsModule, RouterModule, StatusBadgeComponent, ItemsEditorComponent, InitialsPipe, PhonePipe, PlatePipe, RelativeTimePipe,
    MediaPickerComponent, ResizableImageComponent, ImageLightboxComponent,
  ],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss',
})
export class OrderDetailComponent implements OnInit, OnDestroy {

  @ViewChild('editor') editor?: ElementRef<HTMLDivElement>;

  readonly STATUS_LABEL = STATUS_LABEL;
  readonly StatusOS = StatusOS;
  readonly AppointmentType = AppointmentTypeEnum;
  readonly flow: StatusOS[] = [StatusOS.PENDENTE, StatusOS.EM_ATENDIMENTO, StatusOS.AGUARDANDO_PECAS, StatusOS.FINALIZADA];

  wo: WorkOrderDetail | null = null;
  loading = true;
  notFound = false;
  isStaff = false;
  myUserId: number | null = null;

  workers: UserList[] = [];
  savingStatus: StatusOS | null = null;
  savingResponsible = false;

  noteHtml = '';
  noteType: AppointmentTypeEnum = AppointmentTypeEnum.PUBLICO;
  sendingNote = false;
  noteFiles: PickedFile[] = [];

  /** imagem aberta em tela cheia */
  lightbox: { images: LightboxImage[]; index: number } | null = null;

  // financeiro
  @ViewChild(ItemsEditorComponent) itemsEditor?: ItemsEditorComponent;
  savingItem = false;
  payMethod: PaymentMethod = 'PIX';
  payAmount: number | null = null;
  savingPayment = false;
  readonly PAYMENT_LABEL = PAYMENT_LABEL;
  readonly paymentMethods = Object.keys(PAYMENT_LABEL) as PaymentMethod[];

  // avaliação (cliente)
  reviewRating = 0;
  reviewHover = 0;
  reviewComment = '';
  sendingReview = false;

  private readonly subs = new Subscription();

  constructor(
    private readonly _route: ActivatedRoute,
    private readonly _router: Router,
    private readonly _title: Title,
    private readonly _workOrders: WorkOrderService,
    private readonly _userCorp: UserCorporationService,
    private readonly _auth: AuthService,
    private readonly _toastr: ToastrService,
    private readonly _billing: BillingService,
    private readonly _undo: UndoService,
    readonly session: SessionService,
  ) {}

  ngOnInit(): void {
    this.subs.add(this.session.isStaff$.subscribe(v => this.isStaff = v));
    this.subs.add(this._auth.user$.subscribe(ctx => this.myUserId = ctx?.user?.id ?? null));

    this.subs.add(this._route.paramMap.pipe(
      map(p => Number(p.get('id'))),
      switchMap(id => {
        this.loading = true;
        this.notFound = false;
        return this._workOrders.getById(id);
      }),
    ).subscribe({
      next: wo => this.setWo(wo),
      error: () => { this.loading = false; this.notFound = true; },
    }));

    this.subs.add(this._auth.user$.pipe(
      map(ctx => ctx?.usercorp?.establishment?.id),
      filter((id): id is number => !!id),
      take(1),
      switchMap(idEstab => this._userCorp.getWorkersByEstablishments({ idEstab })),
    ).subscribe({
      next: (rows: any[]) => this.workers = rows.map(r => r.user),
      error: () => this.workers = [],
    }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.clearPicked();
  }

  private reload(id: number): void {
    this._workOrders.getById(id).subscribe(wo => this.setWo(wo));
  }

  private setWo(wo: WorkOrderDetail): void {
    this.wo = wo;
    this.loading = false;
    if (!this.canWriteInternal) this.noteType = AppointmentTypeEnum.PUBLICO;
    this._title.setTitle(`OS #${wo.numberOs} · ${wo.client.name} · Odramech`);
  }

  // ── Status ───────────────────────────────────────────────
  get flowIndex(): number {
    return this.wo ? this.flow.indexOf(this.wo.status) : -1;
  }

  get isClosed(): boolean {
    return this.wo?.status === StatusOS.FINALIZADA || this.wo?.status === StatusOS.CANCELADA;
  }

  get progress(): number {
    if (!this.wo) return 0;
    if (this.wo.status === StatusOS.CANCELADA) return 0;
    // os passos ficam em 4 colunas (esq., centro, centro, dir.) → pontos em 0 / 37,5 / 62,5 / 100%
    return [0, 37.5, 62.5, 100][Math.max(0, this.flowIndex)] ?? 0;
  }

  setStatus(status: StatusOS): void {
    if (!this.wo || !this.isStaff || this.wo.status === status || this.savingStatus) return;

    if (status === StatusOS.CANCELADA && !confirm(`Cancelar a OS #${this.wo.numberOs}? Ela poderá ser reaberta depois.`)) return;

    this.savingStatus = status;
    const id = this.wo.id;
    this._workOrders.updateStatus(id, status).subscribe({
      next: ({ undoToken, ...wo }) => {
        this.setWo(wo);
        this.savingStatus = null;
        if (undoToken) {
          this._undo.offer({
            label: `OS #${wo.numberOs} → ${STATUS_LABEL[status]}`,
            undo: () => this._workOrders.undo(undoToken),
            onUndone: () => this.reload(id),
          });
        }
      },
      error: err => {
        this.savingStatus = null;
        this._toastr.error(err?.error?.message ?? 'Não foi possível alterar o status.');
      },
    });
  }

  // ── Responsável ──────────────────────────────────────────
  setResponsible(id: number | null): void {
    if (!this.wo) return;
    this.savingResponsible = true;
    const woId = this.wo.id;
    this._workOrders.updateResponsible(woId, id).subscribe({
      next: ({ undoToken, ...wo }) => {
        this.setWo(wo);
        this.savingResponsible = false;
        const label = id ? `${wo.userResponsible?.name} agora é o responsável` : 'Responsável removido';
        if (undoToken) {
          this._undo.offer({ label, undo: () => this._workOrders.undo(undoToken), onUndone: () => this.reload(woId) });
        } else {
          this._toastr.success(label + '.');
        }
      },
      error: err => {
        this.savingResponsible = false;
        this._toastr.error(err?.error?.message ?? 'Não foi possível alterar o responsável.');
      },
    });
  }

  // ── Permissões do histórico (vêm do backend) ─────────────
  /** equipe sempre; cliente só se o estabelecimento liberou */
  // sem `permissions` (backend antigo durante a atualização), vale a regra anterior: só a equipe escreve
  get canWrite(): boolean { return this.wo?.permissions ? this.wo.permissions.canWrite : this.isStaff; }
  get canAttach(): boolean { return this.wo?.permissions ? this.wo.permissions.canAttach : this.isStaff; }
  get canWriteInternal(): boolean {
    return this.wo?.permissions ? this.wo.permissions.types.includes(AppointmentTypeEnum.INTERNO) : this.isStaff;
  }

  canDeleteFile(appt: Appointment): boolean {
    return this.isStaff || appt.userAppointment.id === this.myUserId;
  }

  // ── Timeline ─────────────────────────────────────────────
  get timeline(): TimelineItem[] {
    if (!this.wo) return [];
    const items: TimelineItem[] = [
      { kind: 'event', at: this.wo.dateTimeCreation, icon: 'fa-solid fa-door-open', text: 'abriu a ordem de serviço', who: this.wo.userCreation?.name },
      ...this.wo.appointments.map(a => ({ kind: 'note' as const, at: a.dateTime, appt: a })),
    ];
    if (this.wo.dateTimeEnd) {
      const finished = this.wo.status === StatusOS.FINALIZADA;
      items.push({
        kind: 'event',
        at: this.wo.dateTimeEnd,
        icon: finished ? 'fa-solid fa-flag-checkered' : 'fa-solid fa-ban',
        text: finished ? 'finalizou a ordem de serviço' : 'cancelou a ordem de serviço',
        who: this.wo.userEnd?.name,
      });
    }
    return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }

  // o getter `timeline` monta objetos novos a cada ciclo: sem trackBy o Angular recriaria
  // todo o histórico (e as fotos perderiam o redimensionamento no meio do arraste)
  trackTimeline(_: number, item: TimelineItem): string {
    return item.kind === 'note' ? `n${item.appt.id}` : `e${item.icon}${item.at}`;
  }

  trackArchive(_: number, a: ArchiveAppointment): number { return a.id; }

  format(cmd: string): void {
    document.execCommand(cmd, false);
    this.editor?.nativeElement.focus();
  }

  onEditorInput(): void {
    const el = this.editor?.nativeElement;
    el?.querySelectorAll('img').forEach((img: HTMLImageElement) => img.remove());
    this.noteHtml = el?.innerHTML ?? '';
  }

  onEditorPaste(e: ClipboardEvent): void {
    const data = e.clipboardData;
    if (!data) return;
    const files = Array.from(data.files ?? []);
    if (files.length) {
      e.preventDefault();
      this.attachFromEditor(files);
      return;
    }
    if (/<img\b/i.test(data.getData('text/html'))) {
      e.preventDefault();
      document.execCommand('insertText', false, data.getData('text/plain'));
    }
  }

  onEditorDrop(e: DragEvent): void {
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (!files.length) return;
    e.preventDefault();
    this.attachFromEditor(files);
  }

  private attachFromEditor(files: File[]): void {
    if (!this.canAttach) {
      this._toastr.info('Seu plano não inclui anexos nos apontamentos.');
      return;
    }
    this.addFiles(files);
  }

  get noteIsEmpty(): boolean {
    return !this.noteHtml.replace(/<[^>]*>|&nbsp;/g, '').trim();
  }

  sendNote(): void {
    if (!this.wo || (this.noteIsEmpty && !this.noteFiles.length) || this.sendingNote) return;
    this.sendingNote = true;

    const files = this.noteFiles.map(p => p.file);
    const images = files.filter(f => f.type.startsWith('image/')).length;
    const html = this.noteIsEmpty
      ? `<p>${images === files.length ? `${files.length} foto(s)` : `${files.length} anexo(s)`}</p>`
      : this.noteHtml;

    this._workOrders.addAppointment(this.wo.id, html, this.noteType).pipe(
      switchMap(appt => files.length
        ? this._billing.uploadFiles(appt.id, files).pipe(map(archives => ({ ...appt, archives })))
        : of(appt)),
    ).subscribe({
      next: appt => {
        this.wo = { ...this.wo!, appointments: [...this.wo!.appointments, appt] };
        this.noteHtml = '';
        this.clearPicked();
        if (this.editor) this.editor.nativeElement.innerHTML = '';
        this.sendingNote = false;
        this._toastr.success(this.noteType === AppointmentTypeEnum.INTERNO ? 'Nota interna registrada.' : (this.isStaff ? 'Apontamento registrado.' : 'Mensagem enviada para a oficina.'));
      },
      error: err => {
        this.sendingNote = false;
        this._toastr.error(err?.error?.message ?? 'Não foi possível salvar o apontamento.');
      },
    });
  }

  onEditorKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      this.sendNote();
    }
  }

  back(): void { this._router.navigate(['/orders']); }

  // ── Anexos ───────────────────────────────────────────────
  /** vem do app-media-picker (câmera, galeria ou arquivo), fotos já reduzidas */
  addFiles(picked: File[]): void {
    const tooBig = picked.filter(f => f.size > MAX_FILE_BYTES);
    if (tooBig.length) this._toastr.warning(`${tooBig.length} arquivo(s) acima de 10 MB foram ignorados.`);

    const room = MAX_FILES - this.noteFiles.length;
    const accepted = picked.filter(f => f.size <= MAX_FILE_BYTES);
    if (accepted.length > room) this._toastr.info(`Até ${MAX_FILES} arquivos por apontamento.`);

    this.noteFiles = [
      ...this.noteFiles,
      ...accepted.slice(0, Math.max(0, room)).map(file => ({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      })),
    ];
  }

  removePicked(i: number): void {
    const p = this.noteFiles[i];
    if (p?.preview) URL.revokeObjectURL(p.preview);
    this.noteFiles = this.noteFiles.filter((_, idx) => idx !== i);
  }

  private clearPicked(): void {
    this.noteFiles.forEach(p => p.preview && URL.revokeObjectURL(p.preview));
    this.noteFiles = [];
  }

  imagesOf(appt: Appointment): ArchiveAppointment[] {
    return (appt.archives ?? []).filter(a => a.archiveType === 'IMAGEM');
  }

  othersOf(appt: Appointment): ArchiveAppointment[] {
    return (appt.archives ?? []).filter(a => a.archiveType !== 'IMAGEM');
  }

  /** abre a foto inteira; as setas passam pelas outras fotos da OS inteira */
  openImage(a: ArchiveAppointment): void {
    if (!this.wo) return;
    const all = this.wo.appointments.flatMap(ap => this.imagesOf(ap));
    this.lightbox = {
      images: all.map(x => ({ src: this.fileUrl(x), name: x.originalName })),
      index: Math.max(0, all.findIndex(x => x.id === a.id)),
    };
  }

  fileUrl(a: ArchiveAppointment): string { return this._billing.fileUrl(a.id); }

  fileSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  deleteFile(apptId: number, a: ArchiveAppointment): void {
    if (!this.wo || !confirm(`Excluir o anexo "${a.originalName}"?`)) return;
    this._billing.deleteFile(a.id).subscribe({
      next: () => {
        this.wo = {
          ...this.wo!,
          appointments: this.wo!.appointments.map(ap => ap.id === apptId ? { ...ap, archives: ap.archives.filter(x => x.id !== a.id) } : ap),
        };
      },
      error: err => this._toastr.error(err?.error?.message ?? 'Não foi possível excluir o anexo.'),
    });
  }

  // ── Peças e serviços ─────────────────────────────────────
  get canEditMoney(): boolean {
    return this.isStaff && this.wo?.status !== StatusOS.CANCELADA;
  }

  private recompute(items: ServiceItem[], payments = this.wo!.payments): void {
    const total = Math.round(items.reduce((a, i) => a + i.total, 0) * 100) / 100;
    const paid = Math.round(payments.reduce((a, p) => a + p.amount, 0) * 100) / 100;
    this.wo = { ...this.wo!, items, payments, summary: { total, paid, balance: Math.round((total - paid) * 100) / 100 } };
  }

  addItem(input: ServiceItemInput): void {
    if (!this.wo) return;
    this.savingItem = true;
    this._billing.addWorkOrderItem(this.wo.id, input).subscribe({
      next: item => {
        this.recompute([...this.wo!.items, item]);
        this.savingItem = false;
        this.itemsEditor?.reset();
      },
      error: err => {
        this.savingItem = false;
        this._toastr.error(err?.error?.message ?? 'Não foi possível adicionar o item.');
      },
    });
  }

  removeItem(item: ServiceItem): void {
    this._billing.deleteItem(item.id).subscribe({
      next: () => this.recompute(this.wo!.items.filter(i => i.id !== item.id)),
      error: err => this._toastr.error(err?.error?.message ?? 'Não foi possível remover o item.'),
    });
  }

  // ── Pagamentos ───────────────────────────────────────────
  get paidPct(): number {
    const s = this.wo?.summary;
    if (!s || !s.total) return 0;
    return Math.min(100, (s.paid / s.total) * 100);
  }

  fillBalance(): void {
    this.payAmount = Math.max(0, this.wo?.summary.balance ?? 0) || null;
  }

  addPayment(): void {
    if (!this.wo || !this.payAmount || this.payAmount <= 0 || this.savingPayment) return;
    this.savingPayment = true;
    this._billing.addPayment(this.wo.id, this.payMethod, Number(this.payAmount)).subscribe({
      next: p => {
        this.recompute(this.wo!.items, [...this.wo!.payments, p]);
        this.payAmount = null;
        this.savingPayment = false;
        this._toastr.success(`${PAYMENT_LABEL[p.method]} de ${p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} registrado.`);
      },
      error: err => {
        this.savingPayment = false;
        this._toastr.error(err?.error?.message ?? 'Não foi possível registrar o pagamento.');
      },
    });
  }

  removePayment(id: number): void {
    if (!confirm('Estornar este pagamento?')) return;
    this._billing.deletePayment(id).subscribe({
      next: () => this.recompute(this.wo!.items, this.wo!.payments.filter(p => p.id !== id)),
      error: err => this._toastr.error(err?.error?.message ?? 'Não foi possível estornar.'),
    });
  }

  // ── Avaliação ────────────────────────────────────────────
  get canReview(): boolean {
    return !this.isStaff && this.wo?.status === StatusOS.FINALIZADA && !this.wo?.review;
  }

  sendReview(): void {
    if (!this.wo || !this.reviewRating || this.sendingReview) return;
    this.sendingReview = true;
    this._billing.review(this.wo.id, this.reviewRating, this.reviewComment).subscribe({
      next: review => {
        this.wo = { ...this.wo!, review };
        this.sendingReview = false;
        this._toastr.success('Obrigado pela avaliação!');
      },
      error: err => {
        this.sendingReview = false;
        this._toastr.error(err?.error?.message ?? 'Não foi possível enviar a avaliação.');
      },
    });
  }

  durationLabel(): string {
    if (!this.wo) return '';
    const end = this.wo.dateTimeEnd ? new Date(this.wo.dateTimeEnd) : new Date();
    const ms = end.getTime() - new Date(this.wo.dateTimeCreation).getTime();
    const h = Math.floor(ms / 3_600_000);
    if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
    if (h < 48) return `${h} h`;
    return `${Math.round(h / 24)} dias`;
  }
}
