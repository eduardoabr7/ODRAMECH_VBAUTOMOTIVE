import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { filter, map, switchMap, takeUntil, tap } from 'rxjs/operators';

import { ModalCreateUserComponent } from '@shared/components/modals/user-modals/modal-create-user/modal-create-user.component';
import { ModalCreateVehicleComponent } from '@shared/components/modals/vehicle-modals/modal-create-vehicle/modal-create-vehicle.component';
import { CloseOnClickOutsideDirective } from '@shared/directives/close-onclick-outside.directive';
import { RoleEnum } from '@shared/enums/role.enum';
import { STATUS_LABEL, StatusOS } from '@shared/enums/status-os.enum';
import { AppointmentTypeEnum } from '@shared/enums/type-appointment.enum';
import { AuthContext } from '@shared/models/AuthContext';
import { Vehicle } from '@shared/models/Vehicle';
import { UserList } from '@shared/models/UserList';
import { WorkOrderCreate } from '@shared/models/WorkOrderCreate';
import { AuthService } from '@shared/services/auth.service';
import { UserCorporationService } from '@shared/services/user-corporation.service';
import { UserService } from '@shared/services/user.service';
import { VehicleService } from '@shared/services/vehicle.service';
import { WorkOrderService } from '@shared/services/work-orders.service';
import { StatusBadgeComponent } from '@shared/ui/status-badge.component';
import { InitialsPipe, PhonePipe, PlatePipe } from '@shared/ui/pipes';

@Component({
  selector: 'app-new-os',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, CloseOnClickOutsideDirective, StatusBadgeComponent, InitialsPipe, PhonePipe, PlatePipe],
  templateUrl: './new-os.component.html',
  styleUrls: ['./new-os.component.scss'],
})
export class NewOsComponent implements OnInit, OnDestroy {

  @ViewChild('editorRef') editorRef!: ElementRef<HTMLDivElement>;
  @ViewChild('searchRef') searchRef?: ElementRef<HTMLInputElement>;

  readonly StatusOS = StatusOS;
  readonly AppointmentType = AppointmentTypeEnum;
  readonly STATUS_LABEL = STATUS_LABEL;

  osForm!: FormGroup;

  now = new Date();
  isSubmitting = false;

  authContext!: AuthContext;

  clientResults: UserList[] = [];
  showClientDropdown = false;
  selectedClient: UserList | null = null;
  isSearchingClient = false;
  searchEmpty = false;
  activeIndex = 0;
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  workers: UserList[] = [];

  clientVehicles: Vehicle[] = [];
  selectedVehicle: Vehicle | null = null;
  isLoadingVehicles = false;
  private vehicleModalRef: BsModalRef | null = null;

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
    private readonly workOrderService: WorkOrderService,
    private readonly toastr: ToastrService,
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
      appointmentType: [AppointmentTypeEnum.PUBLICO],
    });
  }

  private loadAuthAndWorkers(): void {
    this.authService.user$
      .pipe(
        takeUntil(this.destroy$),
        tap(authCtx => { this.authContext = authCtx; }),
        map(authCtx => authCtx?.usercorp?.establishment?.id),
        filter((id): id is number => !!id),
        switchMap(idEstab => this.userCorporationService.getWorkersByEstablishments({ idEstab })),
      )
      .subscribe(users => {
        this.workers = users
          .filter(u => u.role === RoleEnum.WORKER || u.role === RoleEnum.ADMIN)
          .map(u => u.user);
      });
  }

  // ── Etapas ───────────────────────────────────────────────
  get step(): number {
    if (!this.selectedClient) return 1;
    if (!this.selectedVehicle) return 2;
    return 3;
  }

  // ── Cliente ──────────────────────────────────────────────
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
          this.activeIndex = 0;
          this.isSearchingClient = false;
          this.searchEmpty = results.length === 0;
        },
        error: () => {
          this.isSearchingClient = false;
          this.searchEmpty = true;
        },
      });
    }, 300);
  }

  onSearchKeydown(e: KeyboardEvent): void {
    if (!this.showClientDropdown || !this.clientResults.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.activeIndex = (this.activeIndex + 1) % this.clientResults.length; }
    if (e.key === 'ArrowUp') { e.preventDefault(); this.activeIndex = (this.activeIndex - 1 + this.clientResults.length) % this.clientResults.length; }
    if (e.key === 'Enter') { e.preventDefault(); this.selectClient(this.clientResults[this.activeIndex]); }
    if (e.key === 'Escape') { this.showClientDropdown = false; }
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
    setTimeout(() => this.searchRef?.nativeElement.focus());
  }

  goToNewClient(): void {
    this.showClientDropdown = false;
    const ref = this.bsModalService.show(ModalCreateUserComponent, {
      initialState: { title: 'Novo cliente' },
      class: 'modal-lg',
    });

    ref.content?.onClose.pipe(takeUntil(this.destroy$)).subscribe((created: any) => {
      if (created?.id) {
        this.selectClient({ id: created.id, name: created.name, email: created.email, principalPhone: created.principalPhone });
      }
    });
  }

  // ── Veículo ──────────────────────────────────────────────
  private loadClientVehicles(userId: number): void {
    this.isLoadingVehicles = true;
    this.clientVehicles = [];
    this.selectedVehicle = null;
    this.osForm.patchValue({ vehicleId: null });

    this.vehicleService.getByUser(userId).subscribe({
      next: vehicles => {
        this.clientVehicles = vehicles;
        this.isLoadingVehicles = false;
        if (vehicles.length === 1) this.selectVehicle(vehicles[0]);
      },
      error: () => { this.isLoadingVehicles = false; },
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
        title: 'Novo veículo',
        userId: this.selectedClient!.id,
        clientName: this.selectedClient!.name,
      },
      class: 'modal-lg',
    });

    this.vehicleModalRef.content?.vehicleCreated
      ?.pipe(takeUntil(this.destroy$))
      .subscribe((newVehicle: Vehicle) => {
        if (!this.clientVehicles.some(v => v.id === newVehicle.id)) {
          this.clientVehicles = [...this.clientVehicles, newVehicle];
        }
        this.selectVehicle(newVehicle);
      });
  }

  // ── Resumo ───────────────────────────────────────────────
  get responsibleName(): string | null {
    const id = this.osForm.value.userResponsibleId;
    if (!id) return null;
    return this.workers.find(w => w.id === id)?.name ?? null;
  }

  setStatus(status: StatusOS): void { this.osForm.patchValue({ status }); }
  setType(type: AppointmentTypeEnum): void { this.osForm.patchValue({ appointmentType: type }); }

  // ── Editor ───────────────────────────────────────────────
  formatText(command: string): void {
    document.execCommand(command, false);
    this.editorRef.nativeElement.focus();
  }

  onEditorInput(event: Event): void {
    this.editorContent = (event.target as HTMLDivElement).innerHTML;
  }

  private get hasNote(): boolean {
    return !!this.editorContent.replace(/<[^>]*>|&nbsp;/g, '').trim();
  }

  goBack(): void {
    this.router.navigate(['/orders']);
  }

  onSubmit(): void {
    if (this.osForm.invalid || !this.selectedClient || !this.selectedVehicle || this.isSubmitting) return;

    this.isSubmitting = true;

    const payload: WorkOrderCreate = {
      status: this.osForm.value.status as StatusOS,
      clientId: this.selectedClient.id,
      vehicleId: this.selectedVehicle.id,
      ...(this.osForm.value.userResponsibleId && {
        userResponsibleId: this.osForm.value.userResponsibleId,
      }),
      ...(this.hasNote && {
        appointment: {
          contentHtml: this.editorContent,
          appointmentType: this.osForm.value.appointmentType as AppointmentTypeEnum,
        },
      }),
    };

    this.workOrderService.create(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (wo) => {
          this.isSubmitting = false;
          this.toastr.success(`${this.selectedClient?.name} · ${this.selectedVehicle?.make} ${this.selectedVehicle?.name}`, `OS #${wo.numberOs} aberta`);
          this.router.navigate(['/orders', wo.id]);
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastr.error(err?.error?.message ?? 'Não foi possível abrir a OS.');
        },
      });
  }
}
