import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { NgxMaskDirective } from 'ngx-mask';
import { finalize } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

import { BaseModalComponent } from '../../base-modal.component';
import { CloseOnClickOutsideDirective } from '@shared/directives/close-onclick-outside.directive';
import { VehicleService } from '@shared/services/vehicle.service';
import { VehicleCreate } from '@shared/models/VehicleCreate';
import { Vehicle } from '@shared/models/Vehicle';
import { ModalLoadingComponent } from '../../modal-loading/modal-loading.component';

interface ColorOption {
  label: string;
  hex: string;
}

@Component({
  selector: 'app-modal-create-vehicle',
  imports: [CommonModule, FormsModule, NgxMaskDirective, CloseOnClickOutsideDirective],
  templateUrl: './modal-create-vehicle.component.html',
  styleUrl: './modal-create-vehicle.component.scss',
})
export class ModalCreateVehicleComponent extends BaseModalComponent implements OnInit {

  userId!: number;       // era clientId
  clientName?: string;

  @Output() vehicleCreated = new EventEmitter<Vehicle>();

  isSubmitting = false;
  isCheckingPlate = false;
  plateAlreadyExists = false;
  existingVehicle: Vehicle | null = null;

  currentYear = new Date().getFullYear();

  readonly allMakes = [
    'Chevrolet', 'Fiat', 'Volkswagen', 'Ford', 'Toyota', 'Honda',
    'Hyundai', 'Renault', 'Jeep', 'Nissan', 'BMW', 'Mercedes-Benz',
    'Audi', 'Peugeot', 'Citroën', 'Mitsubishi', 'Kia', 'Subaru',
    'Land Rover', 'Volvo', 'Dodge', 'Ram', 'Yamaha', 'Honda Motos', 'JAC Motors'
  ];

  filteredMakes: string[] = [];
  showMakeDropdown = false;

  readonly colorOptions: ColorOption[] = [
    { label: 'Branco',  hex: '#f8f9fa' },
    { label: 'Prata',   hex: '#adb5bd' },
    { label: 'Cinza',   hex: '#6c757d' },
    { label: 'Preto',   hex: '#212529' },
    { label: 'Vermelho',hex: '#dc3545' },
    { label: 'Azul',    hex: '#00007A' },
    { label: 'Verde',   hex: '#198754' },
    { label: 'Amarelo', hex: '#ffc107' },
    { label: 'Laranja', hex: '#fd7e14' },
    { label: 'Marrom',  hex: '#795548' },
  ];
  selectedColorHex: string | null = null;

  form: VehicleCreate = {
    plate: '',
    name: '',
    make: '',
    color: '',
    km: '',
    modelYear: undefined,
    manufactureYear: undefined,
    userId: 0,
  };

  constructor(
    bsModalRef: BsModalRef,
    private readonly vehicleService: VehicleService,
    private readonly toastr: ToastrService,
    private readonly modalService: BsModalService,
  ) {
    super(bsModalRef);
  }

  ngOnInit(): void {}

  // ─── Placa ────────────────────────────────────────────────────────────────────

  onPlateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let raw = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    raw = raw.slice(0, 7);

    const isMercosul = raw.length >= 5 && /[0-9]/.test(raw[3]) && /[A-Z]/.test(raw[4]);

    let formatted = raw;
    if (!isMercosul && raw.length > 3) {
      formatted = raw.slice(0, 3) + '-' + raw.slice(3);
    }

    this.form.plate = formatted;
    input.value = formatted;

    // Reseta o estado de placa existente ao editar
    this.plateAlreadyExists = false;
    this.existingVehicle = null;
  }

  onPlateBlur(): void {
    if (!this.isValidPlate(this.form.plate)) return;

    const raw = this.form.plate.replace(/[^A-Z0-9]/g, '');
    this.isCheckingPlate = true;

    this.vehicleService.checkPlate(raw).subscribe({
      next: ({ exists, vehicle }) => {
        this.isCheckingPlate = false;
        this.plateAlreadyExists = exists;
        this.existingVehicle = vehicle ?? null;
      },
      error: () => {
        this.isCheckingPlate = false;
      },
    });
  }

  private isValidPlate(plate: string): boolean {
    const raw = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const antigo   = /^[A-Z]{3}[0-9]{4}$/;
    const mercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
    return antigo.test(raw) || mercosul.test(raw);
  }

  /**
   * Veículo já existe: apenas vincula ao usuário sem criar novo.
   */
  linkExistingVehicle(): void {
    if (!this.existingVehicle) return;
    this.isSubmitting = true;

    const loadingRef = ModalLoadingComponent.open(
      this.modalService,
      'Vinculando veículo',
      'Aguarde...',
    );

    this.vehicleService.linkToUser(this.existingVehicle.id, this.userId).pipe(
      finalize(() => {
        this.isSubmitting = false;
        loadingRef.hide();
      }),
    ).subscribe({
      next: () => {
        this.toastr.success('Veículo vinculado com sucesso!');
        this.vehicleCreated.emit(this.existingVehicle!);
        this.confirm(this.existingVehicle);
      },
      error: (err) => {
        const message = err?.error?.message ?? 'Erro ao vincular veículo.';
        this.toastr.error(message);
      },
    });
  }

  // ─── Cor ──────────────────────────────────────────────────────────────────────

  get isPreviewReady(): boolean {
    return !!(this.form.make && this.form.name && this.form.plate);
  }

  selectColor(color: ColorOption): void {
    if (this.form.color === color.label) {
      this.form.color = '';
      this.selectedColorHex = null;
    } else {
      this.form.color = color.label;
      this.selectedColorHex = color.hex;
    }
  }

  // ─── Marca ────────────────────────────────────────────────────────────────────

  onMakeInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value.trim().toLowerCase();
    if (term.length === 0) {
      this.filteredMakes = [];
      this.showMakeDropdown = false;
      return;
    }
    this.filteredMakes = this.allMakes.filter(m => m.toLowerCase().includes(term));
    this.showMakeDropdown = this.filteredMakes.length > 0;
  }

  selectMake(make: string): void {
    this.form.make = make;
    this.showMakeDropdown = false;
    this.filteredMakes = [];
  }

  // ─── Submit ───────────────────────────────────────────────────────────────────

  private normalizePayload(): VehicleCreate {
    return {
      ...this.form,
      plate: this.form.plate.toUpperCase().replace(/[^A-Z0-9]/g, ''),
      color: this.form.color?.trim() || undefined,
      km: this.form.km?.toString().trim() || undefined,
      modelYear: this.form.modelYear || undefined,
      manufactureYear: this.form.manufactureYear || undefined,
      userId: this.userId,
    };
  }

  createVehicle(): void {
    if (this.isSubmitting) return;

    if (!this.isValidPlate(this.form.plate)) {
      this.toastr.error('Placa inválida. Use o formato ABC-1234 ou ABC1D23.');
      return;
    }

    this.isSubmitting = true;

    const payload = this.normalizePayload();

    const loadingRef = ModalLoadingComponent.open(
      this.modalService,
      'Cadastrando veículo',
      'Aguarde...',
    );

    this.vehicleService.create(payload).pipe(
      finalize(() => {
        this.isSubmitting = false;
        loadingRef.hide();
      }),
    ).subscribe({
      next: (vehicle) => {
        this.toastr.success('Veículo cadastrado com sucesso!');
        this.vehicleCreated.emit(vehicle);
        this.confirm(vehicle);
      },
      error: (err) => {
        const message = err?.error?.message ?? 'Erro ao cadastrar veículo.';
        this.toastr.error(message);
      },
    });
  }
}