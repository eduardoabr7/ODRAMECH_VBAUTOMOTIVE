import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

// ── Interfaces (ajuste conforme seus serviços reais) ──────────────────────────

interface UserSummary {
  id: number;
  name: string;
  principalPhone: string;
  email?: string;
}

interface AuthContext {
  user?: UserSummary;
}

interface CorpLogged {
  name: string;
  establishment?: {
    name: string;
    role?: string;
  };
}

// ── Enums espelhando o schema Prisma ──────────────────────────────────────────

type OrderStatus =
  | 'PENDENTE'
  | 'EM_ATENDIMENTO'
  | 'AGUARDANDO_PECAS'
  | 'FINALIZADA'
  | 'CANCELADA';

type TypeAppointment = 'PUBLICO' | 'INTERNO';

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-new-os',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './new-os.component.html',
  styleUrls: ['./new-os.component.scss'],
})
export class NewOsComponent implements OnInit {

  @ViewChild('editorRef') editorRef!: ElementRef<HTMLDivElement>;

  // ── Context (injete seus serviços reais) ──────────────────────────────────
  authContext: AuthContext = { user: { id: 1, name: 'João Silva', principalPhone: '' } };
  corpLogged: CorpLogged = { name: 'Oficina Central', establishment: { name: 'Filial Norte', role: 'ADMIN' } };

  // ── Form ──────────────────────────────────────────────────────────────────
  osForm!: FormGroup;

  // ── State ─────────────────────────────────────────────────────────────────
  nextOsNumber = 1042;
  now = new Date();
  isSubmitting = false;
  isDragging = false;

  // ── Client search ─────────────────────────────────────────────────────────
  clientResults: UserSummary[] = [];
  showClientDropdown = false;
  selectedClient: UserSummary | null = null;

  // ── Workers list ──────────────────────────────────────────────────────────
  workers: UserSummary[] = [
    { id: 2, name: 'Carlos Mecânico', principalPhone: '51999990001' },
    { id: 3, name: 'Ana Técnica',     principalPhone: '51999990002' },
    { id: 4, name: 'Pedro Elétrica',  principalPhone: '51999990003' },
  ];

  // ── Attachments ───────────────────────────────────────────────────────────
  attachedFiles: File[] = [];

  // ── Rich editor content ───────────────────────────────────────────────────
  editorContent = '';

  constructor(private fb: FormBuilder, private router: Router) {}

  ngOnInit(): void {
    this.osForm = this.fb.group({
      clientSearch:      [''],
      userResponsibleId: [null],
      status:            ['PENDENTE', Validators.required],
      appointmentType:   ['PUBLICO'],
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  goBack(): void {
    this.router.navigate(['/']);
  }

  // ── Client search ─────────────────────────────────────────────────────────

  onClientSearch(event: Event): void {
    const term = (event.target as HTMLInputElement).value.trim().toLowerCase();

    if (term.length < 2) {
      this.clientResults = [];
      this.showClientDropdown = false;
      return;
    }

    // TODO: substitua pela chamada real ao seu UserService
    const mockUsers: UserSummary[] = [
      { id: 10, name: 'Maria Fernanda',  principalPhone: '51999990010', email: 'maria@email.com' },
      { id: 11, name: 'Roberto Alves',   principalPhone: '51999990011' },
      { id: 12, name: 'Juliana Costa',   principalPhone: '51999990012', email: 'ju@email.com' },
    ];

    this.clientResults = mockUsers.filter(
      u =>
        u.name.toLowerCase().includes(term) ||
        u.principalPhone.includes(term) ||
        u.email?.toLowerCase().includes(term),
    );
    this.showClientDropdown = true;
  }

  selectClient(client: UserSummary): void {
    this.selectedClient = client;
    this.osForm.patchValue({ clientSearch: '' });
    this.showClientDropdown = false;
    this.clientResults = [];
  }

  clearClient(): void {
    this.selectedClient = null;
  }

  // ── Derived display values ────────────────────────────────────────────────

  get responsibleName(): string | null {
    const id = this.osForm.value.userResponsibleId;
    if (!id) return null;
    return this.workers.find(w => w.id === id)?.name ?? null;
  }

  get statusLabel(): string {
    const map: Record<OrderStatus, string> = {
      PENDENTE:         'Pendente',
      EM_ATENDIMENTO:   'Em Atendimento',
      AGUARDANDO_PECAS: 'Aguardando Peças',
      FINALIZADA:       'Finalizada',
      CANCELADA:        'Cancelada',
    };
    return map[this.osForm.value.status as OrderStatus] ?? '';
  }

  get statusClass(): string {
    const map: Record<OrderStatus, string> = {
      PENDENTE:         'status-pendente',
      EM_ATENDIMENTO:   'status-em-atendimento',
      AGUARDANDO_PECAS: 'status-aguardando',
      FINALIZADA:       'status-finalizada',
      CANCELADA:        'status-cancelada',
    };
    return map[this.osForm.value.status as OrderStatus] ?? '';
  }

  // ── Rich text editor ──────────────────────────────────────────────────────

  formatText(command: string): void {
    document.execCommand(command, false);
    this.editorRef.nativeElement.focus();
  }

  onEditorInput(event: Event): void {
    this.editorContent = (event.target as HTMLDivElement).innerHTML;
  }

  // ── File handling ─────────────────────────────────────────────────────────

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) this.addFiles(Array.from(input.files));
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const files = event.dataTransfer?.files;
    if (files) this.addFiles(Array.from(files));
  }

  private addFiles(files: File[]): void {
    const maxSize = 10 * 1024 * 1024; // 10 MB
    const allowed = files.filter(f => f.size <= maxSize);
    this.attachedFiles = [...this.attachedFiles, ...allowed];
  }

  removeFile(index: number): void {
    this.attachedFiles.splice(index, 1);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.osForm.invalid || !this.selectedClient) return;

    this.isSubmitting = true;

    const payload = {
      // WorkOrder fields
      status:            this.osForm.value.status as OrderStatus,
      clientId:          this.selectedClient.id,
      userResponsibleId: this.osForm.value.userResponsibleId ?? null,
      numberOs:          this.nextOsNumber,
      // userCreationId será preenchido pelo backend com o usuário autenticado

      // Appointment fields (opcional)
      appointment: this.editorContent
        ? {
            contentHtml:    this.editorContent,
            appointmentType: this.osForm.value.appointmentType as TypeAppointment,
            // userAppointmentId será preenchido pelo backend
          }
        : null,

      // Files
      files: this.attachedFiles,
    };

    console.log('Payload OS:', payload);

    // TODO: substitua pela chamada real ao seu WorkOrderService
    // this.workOrderService.create(payload).subscribe({ ... })
    setTimeout(() => {
      this.isSubmitting = false;
      this.router.navigate(['/work-orders']);
    }, 1500);
  }
}