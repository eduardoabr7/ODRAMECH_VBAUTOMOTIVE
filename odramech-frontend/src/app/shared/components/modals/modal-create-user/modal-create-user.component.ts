import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { BaseModalComponent } from "../base-modal.component";
import { BsModalRef } from "ngx-bootstrap/modal";
import { GenderEnum } from "@shared/enums/gender.enum";
import { UserCreate } from "@shared/models/UserCreate";
import { EMPTY, finalize, Observable, tap, zip } from "rxjs";
import { ToastrService } from "ngx-toastr";
import { ZipCodeService } from "@shared/services/zipcode.service";
import cloneDeep from 'lodash/cloneDeep';
import { NgxMaskDirective } from "ngx-mask";
import { UserService } from "@shared/services/user.service";

interface AddressReturn {
  cep: string,
  logradouro: string,
  complemento: string,
  bairro: string,
  localidade: string,
  uf: string,
  ibge: string
}

@Component({
  selector: 'app-modal-create-user',
  imports: [CommonModule, FormsModule, NgxMaskDirective],
  templateUrl: './modal-create-user.component.html',
  styleUrl: './modal-create-user.component.scss'
})

export class ModalCreateUserComponent extends BaseModalComponent {
    constructor(
      bsModalRef: BsModalRef,
      private readonly _toastr: ToastrService,
      private readonly _zipCodeService: ZipCodeService,
      private readonly _userService: UserService
    ) {
        super(bsModalRef);
    }

    GenderEnum = GenderEnum;

    form: UserCreate = {
      name: '',
      gender: undefined,
      email: '',
      password: '',
      principalPhone: '',
      secondaryPhone: '',
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

    loadingSearchZipCode: boolean = false;
    displayAddress: boolean = false;
    displayEmailPassword: boolean = true;
    passwordHidden: boolean = true;

    ngOnInit() {

    }

    validZipCode(zipcode: string): boolean {
      const cep = zipcode?.trim();
    
      if (!/^\d{8}$/.test(cep)) {
        this._toastr.info('CEP inválido para busca');
        return false;
      }
    
      return true;
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


    buscaCep(): Observable<AddressReturn> {
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

    normalizeUser(userForm: UserCreate) {

      let userNormalized = cloneDeep(userForm);

      if(!this.displayAddress) {
        delete userNormalized.address
      }

      if(!this.displayEmailPassword) {
        delete userNormalized.email
        delete userNormalized.password
      }

      return userNormalized
    }

    createUser() {
      const user: UserCreate = this.normalizeUser(this.form)


      this._userService.create(user).subscribe()
    }

}