import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ModalCreateUserComponent } from '@shared/components/modals/user-modals/modal-create-user/modal-create-user.component';
import { ModalCreateVehicleComponent } from '@shared/components/modals/vehicle-modals/modal-create-vehicle/modal-create-vehicle.component';
import { CloseOnClickOutsideDirective } from '@shared/directives/close-onclick-outside.directive';
import { RoleEnum } from '@shared/enums/role.enum';
import { StatusOS } from '@shared/enums/status-os.enum';
import { AuthContext } from '@shared/models/AuthContext';
import { Vehicle } from '@shared/models/Vehicle';
import { UserList } from '@shared/models/UserList';
import { AuthService } from '@shared/services/auth.service';
import { UserCorporationService } from '@shared/services/user-corporation.service';
import { UserService } from '@shared/services/user.service';
import { VehicleService } from '@shared/services/vehicle.service';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Subject } from 'rxjs';
import { filter, map, switchMap, tap, takeUntil } from 'rxjs/operators';

type TypeAppointment = 'PUBLICO' | 'INTERNO';

@Component({
  selector: 'app-new-os',
  imports: [CommonModule, ReactiveFormsModule, CloseOnClickOutsideDirective],
  templateUrl: './new-os.component.html',
  styleUrls: ['./new-os.component.scss'],
})
export class NewOsComponent implements OnInit, OnDestroy {

  @ViewChild('editorRef') editorRef!: ElementRef<HTMLDivElement>;

  osForm!: FormGroup;

  now = new Date();
  isSubmitting = false;
  isDragging = false;

  authContext!: AuthContext;

  clientResults: UserList[] = [];
  showClientDropdown = false;
  selectedClient: UserList | null = null;
  isSearchingClient = false;
  searchEmpty = false;
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  workers: UserList[] = [];

  clientVehicles: Vehicle[] = [];
  selectedVehicle: Vehicle | null = null;
  isLoadingVehicles = false;
  private vehicleModalRef: BsModalRef | null = null;

  attachedFiles: File[] = [];
  editorContent = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly userService: UserService,
    private readonly vehicleService: VehicleService,
    private readonly bsModalService: BsModalService,
    private readonly authService: AuthService,
    private readonly userCorporationService: UserCorporationService,
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.loadAuthAndWorkers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildForm(): void {
    this.osForm = this.fb.group({
      clientSearch: [''],
      vehicleId: [null, Validators.required],
      userResponsibleId: [null],
      status: [StatusOS.PENDENTE, Validators.required],
      appointmentType: ['PUBLICO'],
    });
  }

  private loadAuthAndWorkers(): void {
    this.authService.user$
      .pipe(
        takeUntil(this.destroy$),
        tap(authCtx => { this.authContext = authCtx; }),
        map(authCtx => authCtx?.usercorp?.establishment?.id),
        filter((id): id is number => !!id),
        switchMap(idEstab =>
          this.userCorporationService.getWorkersByEstablishments({ idEstab })
        ),
      )
      .subscribe(users => {
        this.workers = users
          .filter(u => u.role === RoleEnum.WORKER || u.role === RoleEnum.ADMIN)
          .map(u => u.user);
      });
  }

  onClientSearch(event: Event): void {
    const term = (event.target as HTMLInputElement).value.trim();

    if (term.length < 2) {
      this.clientResults = [];
      this.showClientDropdown = false;
      this.searchEmpty = false;
      return;
    }

    this.isSearchingClient = true;
    this.searchEmpty = false;
    this.showClientDropdown = true;

    if (this.searchTimeout) clearTimeout(this.searchTimeout);

    this.searchTimeout = setTimeout(() => {
      this.userService.search(term).subscribe({
        next: results => {
          this.clientResults = results;
          this.isSearchingClient = false;
          this.searchEmpty = results.length === 0;
        },
        error: () => {
          this.isSearchingClient = false;
          this.searchEmpty = true;
        },
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

    this.loadClientVehicles(client.id);
  }

  clearClient(): void {
    this.selectedClient = null;
    this.clientVehicles = [];
    this.selectedVehicle = null;
    this.osForm.patchValue({ vehicleId: null });
  }

  goToNewClient(): void {
    this.bsModalService.show(ModalCreateUserComponent, {
      initialState: { title: 'Novo Cliente' },
      class: 'modal-lg',
    });
  }

  private loadClientVehicles(userId: number): void {
    this.isLoadingVehicles = true;
    this.clientVehicles = [];
    this.selectedVehicle = null;
    this.osForm.patchValue({ vehicleId: null });
  
    this.vehicleService.getByUser(userId).subscribe({
      next: vehicles => {
        this.clientVehicles = vehicles;
        this.isLoadingVehicles = false;
      
        if (vehicles.length === 1) {
          this.selectVehicle(vehicles[0]);
        }
      },
      error: () => {
        this.isLoadingVehicles = false;
      },
    });
  }

  selectVehicle(vehicle: Vehicle): void {
    this.selectedVehicle = vehicle;
    this.osForm.patchValue({ vehicleId: vehicle.id });
  }

  clearVehicle(): void {
    this.selectedVehicle = null;
    this.osForm.patchValue({ vehicleId: null });
  }

  openNewVehicleModal(): void {
    this.vehicleModalRef = this.bsModalService.show(ModalCreateVehicleComponent, {
      initialState: {
        userId: this.selectedClient!.id,
        clientName: this.selectedClient!.name,
      },
      class: 'modal-lg',
    });

    this.vehicleModalRef.content?.vehicleCreated
      ?.pipe(takeUntil(this.destroy$))
      .subscribe((newVehicle: Vehicle) => {
        this.clientVehicles = [...this.clientVehicles, newVehicle];
        this.selectVehicle(newVehicle);
        this.vehicleModalRef?.hide();
      });
  }

  get responsibleName(): string | null {
    const id = this.osForm.value.userResponsibleId;
    if (!id) return null;
    return this.workers.find(w => w.id === id)?.name ?? null;
  }

  get statusLabel(): string {
    const labels: Record<StatusOS, string> = {
      [StatusOS.PENDENTE]: 'Pendente',
      [StatusOS.EM_ANDAMENTO]: 'Em Atendimento',
      [StatusOS.AGUARDANDO_PECAS]: 'Aguardando Peças',
      [StatusOS.CONCLUIDO]: 'Concluído',
      [StatusOS.CANCELADO]: 'Cancelado',
    };
    return labels[this.osForm.value.status as StatusOS] ?? '';
  }

  get statusClass(): string {
    const classes: Record<StatusOS, string> = {
      [StatusOS.PENDENTE]: 'status-pendente',
      [StatusOS.EM_ANDAMENTO]: 'status-em-atendimento',
      [StatusOS.AGUARDANDO_PECAS]: 'status-aguardando',
      [StatusOS.CONCLUIDO]: 'status-finalizada',
      [StatusOS.CANCELADO]: 'status-cancelada',
    };
    return classes[this.osForm.value.status as StatusOS] ?? '';
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

  onDragLeave(): void {
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const files = event.dataTransfer?.files;
    if (files) this.addFiles(Array.from(files));
  }

  private addFiles(files: File[]): void {
    const MAX_SIZE = 10 * 1024 * 1024;
    const allowed = files.filter(f => f.size <= MAX_SIZE);
    this.attachedFiles = [...this.attachedFiles, ...allowed];
  }

  removeFile(index: number): void {
    this.attachedFiles = this.attachedFiles.filter((_, i) => i !== index);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  onSubmit(): void {
    if (this.osForm.invalid || !this.selectedClient || !this.selectedVehicle) return;

    this.isSubmitting = true;

    const payload = {
      status: this.osForm.value.status as StatusOS,
      clientId: this.selectedClient.id,
      vehicleId: this.selectedVehicle.id,
      userResponsibleId: this.osForm.value.userResponsibleId ?? null,
      appointment: this.editorContent
        ? {
            contentHtml: this.editorContent,
            appointmentType: this.osForm.value.appointmentType as TypeAppointment,
          }
        : null,
      files: this.attachedFiles,
    };

    console.log('Payload OS:', payload);

    setTimeout(() => {
      this.isSubmitting = false;
      this.router.navigate(['/work-orders']);
    }, 1500);
  }
}