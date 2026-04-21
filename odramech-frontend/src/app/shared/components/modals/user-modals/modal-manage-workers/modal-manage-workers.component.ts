import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { GenderEnum } from '@shared/enums/gender.enum';
import { RoleEnum } from '@shared/enums/role.enum';
import { AddressReturnApi } from '@shared/models/AddressReturnApi';
import { WorkerCreate } from '@shared/models/WorkerCreate';
import { UserCorporationService } from '@shared/services/user-corporation.service';
import { ZipCodeService } from '@shared/services/zipcode.service';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { NgxMaskDirective } from 'ngx-mask';
import { ToastrService } from 'ngx-toastr';
import { EMPTY, finalize, Observable } from 'rxjs';
import cloneDeep from 'lodash/cloneDeep';
import { BaseModalComponent } from '../../base-modal.component';
import { UserService } from '@shared/services/user.service';

interface Worker {
  id: number;
  name: string;
  email: string;
  principalPhone: string;
  role: RoleEnum;
  selected?: boolean;
}

interface NewWorkerForm {
  name: string;
  email: string;
  principalPhone: string;
  role: RoleEnum;
}

@Component({
  selector: 'app-modal-manage-workers',
  imports: [CommonModule, FormsModule, NgxMaskDirective],
  templateUrl: './modal-manage-workers.component.html',
  styleUrl: './modal-manage-workers.component.scss'
})
export class ModalManageWorkersComponent extends BaseModalComponent {

  @ViewChild('workerForm') workerForm!: NgForm;

  idEstablishment: number;
  activeTab: 'all' | RoleEnum.ADMIN | RoleEnum.WORKER = 'all';
  showForm = false;
  searchQuery = '';
  isSubmitting = false;
  GenderEnum = GenderEnum;
  displayAddress: boolean = false;
  loadingSearchZipCode: boolean = false;

  workers: Worker[] = [];
  admins: Worker[]  = [];

  form: WorkerCreate = {
    name: '',
    gender: undefined,
    email: '',
    password: '',
    principalPhone: '',
    secondaryPhone: '',
    role: RoleEnum.WORKER,
    address: {
      street: '',
      number: '',
      complement: undefined,
      city: '',
      district: '',
      zipCode: '',
      country: 'Brasil',
      neighborhood: ''
    }
  }

  readonly RoleEnum = RoleEnum;

  constructor(
    bsModalRef: BsModalRef,
    private readonly _userCorporationService: UserCorporationService,
    private readonly _userService: UserService,
    private readonly _toastr: ToastrService,
    private readonly _zipCodeService: ZipCodeService
  ) {
    super(bsModalRef);
  }

  ngOnInit(): void {
    this.loadWorkers();
  }

  get allEmployees(): Worker[] {
    return [...this.admins, ...this.workers];
  }

  get filteredEmployees(): Worker[] {
    const source =
      this.activeTab === 'all'        ? this.allEmployees :
      this.activeTab === RoleEnum.ADMIN  ? this.admins :
      this.workers;

    const q = this.searchQuery.toLowerCase();
    if (!q) return source;

    return source.filter(w =>
      w.name?.toLowerCase().includes(q) ||
      w.email?.toLowerCase().includes(q) ||
      w.principalPhone?.toLowerCase().includes(q)
    );
  }

  normalizeUser(userForm: WorkerCreate) {
    let userNormalized = cloneDeep(userForm);
    if(!this.displayAddress) {
      delete userNormalized.address
    }
    return userNormalized
  }

  getInitials(name: string): string {
    return name?.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase() ?? '?';
  }

  loadWorkers(): void {
    if (!this.idEstablishment) return;

    this._userCorporationService.getUsersByEstablishments({ idEstab: this.idEstablishment }).subscribe({
      next: (value) => {
        const grouped = value.reduce((acc, item) => {
          acc[item.role] = acc[item.role] || [];
          acc[item.role].push({ ...item.user, role: item.role });
          return acc;
        }, {} as Record<string, Worker[]>);

        this.admins  = grouped[RoleEnum.ADMIN]  || [];
        this.workers = grouped[RoleEnum.WORKER] || [];
      },
      error: () => this._toastr.warning('Erro ao carregar funcionários', 'Atenção')
    });
  }

  setTab(tab: 'all' | RoleEnum.ADMIN | RoleEnum.WORKER): void {
    this.activeTab = tab;
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) this.resetForm();
  }

  resetForm(): void {
    this.form = { name: '', email: '', principalPhone: '', role: RoleEnum.WORKER, gender: undefined };
  }

  setAddressFromZipCode() {
    this.buscaCep().subscribe({
      next: (value) => {
        this.form.address.street = value.logradouro
        this.form.address.complement = value.complemento.trim() || undefined;
        this.form.address.city = value.localidade
        this.form.address.district = value.uf
        this.form.address.neighborhood = value.bairro
      },
      error: () => {
        this._toastr.info('Nenhum endereço encontrado com este CEP');
      }
    });
  }

  buscaCep(): Observable<AddressReturnApi> {
    const zipCode = this.form.address.zipCode;
    const validZipcode = this.validZipCode(zipCode);
  
    if (!validZipcode) return EMPTY;
  
    this.loadingSearchZipCode = true;
  
    return this._zipCodeService.get(zipCode).pipe(
      finalize(() => {
        setTimeout(() => {
          this.loadingSearchZipCode = false;
        }, 1500);
      })
    );
  }

  validZipCode(zipcode: string): boolean {
    const cep = zipcode?.trim();
  
    if (!/^\d{8}$/.test(cep)) {
      this._toastr.info('CEP inválido para busca');
      return false;
    }
  
    return true;
  }

  submitNewWorker(): void {
    if (this.workerForm.invalid) {
      this.workerForm.form.markAllAsTouched();
      this._toastr.warning('Preencha todos os campos obrigatórios', 'Atenção');
      return;
    }

    this.isSubmitting = true;
    const payload = this.normalizeUser(this.form);

    this._userService.createWorker(payload).pipe(
      finalize(() => this.isSubmitting = false)
    ).subscribe({
      next: () => {
        this._toastr.success('Funcionário cadastrado com sucesso!');
        this.loadWorkers();
        this.toggleForm();
      },
      error: (err) => {
        const errorMessage = err.error?.message || 'Erro ao cadastrar funcionário';
        const errorTitle = err.status === 403 ? 'Permissão Negada' : 'Erro';

        this._toastr.error(errorMessage, errorTitle);
        
        console.error('Erro detalhado:', err);
      }
    });
  }
}
