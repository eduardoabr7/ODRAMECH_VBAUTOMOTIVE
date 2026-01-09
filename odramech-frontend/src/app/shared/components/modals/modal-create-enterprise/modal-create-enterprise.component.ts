import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { BaseModalComponent } from '../base-modal.component';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { ModalCreateEstablishmentComponent } from '../modal-create-establishment/modal-create-establishment.component';
import { Address } from '@shared/models/Address';
import { Enterprise } from '@shared/models/Enterprise';
import { Establishment } from '@shared/models/Establishment';
import { NestAPI } from '@shared/services/nest-api.service';
import { EnterpriseService } from '@shared/services/enterprise.service';
import { EnterpriseWithEstablishments } from '@shared/models/EnterpriseWithEstablishment';
import { HttpErrorResponse } from '@angular/common/http';
import { UserCorporation, Role } from '@shared/models/UserCorporation';
import { UserCorporationService } from '@shared/services/user-corporation.service';

interface IdsReturn {
  idEtp: number,
  idEst: number
}

@Component({
  selector: 'app-modal-create-enterprise',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-create-enterprise.component.html',
  styleUrls: ['./modal-create-enterprise.component.scss']
})
export class ModalCreateEnterprise extends BaseModalComponent {
  
  constructor(
    bsModalRef: BsModalRef,
    private readonly _bsModalSvc: BsModalService,
    private readonly _toastr: ToastrService,
    private readonly _enterpriseService: EnterpriseService,
    private readonly _userCorporationService: UserCorporationService
  ) {
      super(bsModalRef);
  }

  @Input() userId: number;
  
  file: File | null = null; //binary file
  imageUrl: string | ArrayBuffer | null = null;
  withCreateEstablisment: boolean = false;

  enterprise: Enterprise = {
    name: '',
    email: '',
    phone: '',
    cnpj: '',
    address: {
      street: '',
      district: '',
      number: '',
      city: '',
      zipCode: '',
      country: ''
    }
  };

  ngOnInit() {
  }

  generatePreview(event: Event) {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.file = file;

      const reader = new FileReader();
      reader.onload = (e) => {
        this.imageUrl = e.target?.result;
      };
      reader.readAsDataURL(file);
    }
  }

  afterCreateEstablishment(): boolean {
    return this.withCreateEstablisment
  }

  async openModalCreateEstablishment() {

    const bsModalRef = this._bsModalSvc.show(ModalCreateEstablishmentComponent, {
      initialState: { 
        title: 'Criar estabelecimento',
        withCadEnterprise: true,
      },
      class: 'modal-lg',
    })
    return await bsModalRef.content.onHide()
    
  }

  haveLoadPhoto(): boolean {
    return !!this.file
  }

  createFirstUserAdminCorporation(idsEstEtp: IdsReturn) {
    if(!this.userId) return

    const { idEtp, idEst } = idsEstEtp

    const dataToSend: UserCorporation = {
      idUser: this.userId,
      idEnterprise: idEtp,
      idEstablishment: idEst,
      role: Role.ADMIN
    }

    this._userCorporationService.createUserCorporation(dataToSend).subscribe(() => {
      this.confirm(true);
    })
  }

  async prosseguir(form: NgForm) {

    if(form.valid) {

      if (this.afterCreateEstablishment()) {
        // captura e guarda os dados de empresa
        const formEnterprise = this.enterprise

        //espera retornar o estabelecimento
        const formEstablishment = await this.openModalCreateEstablishment()

        if(!formEstablishment) return

        const dataToSend: EnterpriseWithEstablishments = {
          enterprise: formEnterprise,
          establishment: formEstablishment
        }

        this._enterpriseService.createEnterpriseWithEstablishment(dataToSend).subscribe({
          next: (rtrn) => {
            this.createFirstUserAdminCorporation(rtrn)
          },
          error: (err: HttpErrorResponse) => {
            this._toastr.error(err.message,'Erro ao criar empresa')
          }
        });
      }

    }

    else {
      this._toastr.error('Preencha corretamente todas as informações obrigatórias.', 'Erro de Validação');
    }
  }


}