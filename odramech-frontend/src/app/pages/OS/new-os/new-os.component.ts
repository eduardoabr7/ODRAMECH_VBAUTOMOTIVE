import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ModalCreateUserComponent } from '@shared/components/modals/user-modals/modal-create-user/modal-create-user.component';
import { CloseOnClickOutsideDirective } from '@shared/directives/close-onclick-outside.directive';
import { RoleEnum } from '@shared/enums/role.enum';
import { StatusOS } from '@shared/enums/status-os.enum';
import { AuthContext } from '@shared/models/AuthContext';
import { Role } from '@shared/models/UserCorporation';
import { UserList } from '@shared/models/UserList';
import { AuthService } from '@shared/services/auth.service';
import { UserCorporationService } from '@shared/services/user-corporation.service';
import { UserService } from '@shared/services/user.service';
import { BsModalService } from 'ngx-bootstrap/modal';
import { filter, map, switchMap, tap } from 'rxjs';

type TypeAppointment = 'PUBLICO' | 'INTERNO';

@Component({
  selector: 'app-new-os',
  imports: [CommonModule, ReactiveFormsModule, CloseOnClickOutsideDirective],
  templateUrl: './new-os.component.html',
  styleUrls: ['./new-os.component.scss'],
})
export class NewOsComponent implements OnInit {

  @ViewChild('editorRef') editorRef!: ElementRef<HTMLDivElement>;

  osForm!: FormGroup;

  nextOsNumber = 1042;
  now = new Date();
  isSubmitting = false;
  isDragging = false;

  authContext: AuthContext
  clientResults: UserList[] = [];
  showClientDropdown = false;
  selectedClient: UserList | null = null;
  searchTimeout: any;
  isSearchingClient = false;
  searchEmpty = false;
  workers: UserList[] = [];

  attachedFiles: File[] = [];

  editorContent = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly userService: UserService,
    private readonly _bsModalService: BsModalService,
    private readonly _authService: AuthService,
    private readonly _userCoporationService: UserCorporationService,
  ) {}

  ngOnInit(): void {
    this.osForm = this.fb.group({
      clientSearch: [''],
      userResponsibleId: [null],
      status: [StatusOS.PENDENTE, Validators.required],
      appointmentType: ['PUBLICO'],
    });
  
    this._authService.user$
      .pipe(
        tap(authCtx => {
          this.authContext = authCtx;
          console.log(this.authContext)
        }),
      
        map(authCtx => authCtx?.usercorp?.establishment?.id),
      
        filter((id): id is number => !!id),
      
        switchMap(idEstab =>
          this._userCoporationService.getWorkersByEstablishments({
            idEstab
          })
        )
      )
      .subscribe(users => {
        const grouped = users.reduce((acc, user) => {
          acc[user.role] = acc[user.role] || [];
          acc[user.role].push(user.user);
          return acc;
        }, {} as Record<string, UserList[]>);
      
        this.workers = users
          .filter(u => u.role === RoleEnum.WORKER || u.role === RoleEnum.ADMIN)
          .map(u => u.user);

          console.log(this.workers)
      });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  onClientSearch(event: Event): void {
    const term = (event.target as HTMLInputElement).value.trim().toLowerCase();

    if (term.length < 2) {
      this.clientResults = [];
      this.showClientDropdown = false;
      this.searchEmpty = false;
      return;
    }

    this.isSearchingClient = true;
    this.searchEmpty = false;
    this.showClientDropdown = true;

    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.userService.search(term).subscribe(results => {
        this.clientResults = results;
        this.isSearchingClient = false;
        this.searchEmpty = results.length === 0;
      });
    }, 400);
  }

  selectClient(client: UserList): void {
    this.selectedClient = client;
    this.osForm.patchValue({ clientSearch: '' });
    this.showClientDropdown = false;
    this.clientResults = [];
    this.searchEmpty = false;
    this.isSearchingClient = false;
  }

  clearClient(): void {
    this.selectedClient = null;
  }

  goToNewClient() {
    this._bsModalService.show(ModalCreateUserComponent, {
      initialState: {
        title: 'Novo Cliente',
      },
      class: 'modal-lg'
    });
  }

  get responsibleName(): string | null {
    const id = this.osForm.value.userResponsibleId;
    if (!id) return null;
    return this.workers.find(w => w.id === id)?.name ?? null;
  }

  get statusLabel(): string {
    const map: Record<StatusOS, string> = {
      [StatusOS.PENDENTE]: 'Pendente',
      [StatusOS.EM_ANDAMENTO]: 'Em andamento',
      [StatusOS.AGUARDANDO_PECAS]: 'Aguardando Peças',
      [StatusOS.CONCLUIDO]: 'Concluído',
      [StatusOS.CANCELADO]: 'Cancelado',
    };

    return map[this.osForm.value.status as StatusOS] ?? '';
  }

  get statusClass(): string {
    const map: Record<StatusOS, string> = {
      [StatusOS.PENDENTE]: 'status-pendente',
      [StatusOS.EM_ANDAMENTO]: 'status-em-atendimento',
      [StatusOS.AGUARDANDO_PECAS]: 'status-aguardando',
      [StatusOS.CONCLUIDO]: 'status-finalizada',
      [StatusOS.CANCELADO]: 'status-cancelada',
    };

    return map[this.osForm.value.status as StatusOS] ?? '';
  }

  formatText(command: string): void {
    document.execCommand(command, false);
    this.editorRef.nativeElement.focus();
  }

  onEditorInput(event: Event): void {
    this.editorContent = (event.target as HTMLDivElement).innerHTML;
  }

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
    const maxSize = 10 * 1024 * 1024;
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

  onSubmit(): void {
    if (this.osForm.invalid || !this.selectedClient) return;

    this.isSubmitting = true;

    const payload = {
      status: this.osForm.value.status as StatusOS,
      clientId: this.selectedClient.id,
      userResponsibleId: this.osForm.value.userResponsibleId ?? null,

      appointment: this.editorContent
        ? {
            contentHtml: this.editorContent,
            appointmentType: this.osForm.value.appointmentType as TypeAppointment,
          }
        : null,

      files: this.attachedFiles,
    };

    setTimeout(() => {
      this.isSubmitting = false;
      this.router.navigate(['/work-orders']);
    }, 1500);
  }
}