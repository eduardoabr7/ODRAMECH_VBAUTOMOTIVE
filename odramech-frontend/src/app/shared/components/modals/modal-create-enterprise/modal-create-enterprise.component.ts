import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { BaseModalComponent } from '../base-modal.component';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { ModalCreateEstablishmentComponent } from './modal-create-establishment/modal-create-establishment.component';
import { Address } from '@shared/models/Address';

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
    private readonly _toastr: ToastrService
  ) {
      super(bsModalRef);
  }

  name: string;
  email: string;
  state: string;
  city: string;
  phone: string;
  address: Address

  file: File | null = null; //binary file
  imageUrl: string | ArrayBuffer | null = null;
  withCreateEstablisment: boolean = false;

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

  prosseguir(form: NgForm) {
    console.log(form.value)
    if (this.withCreateEstablisment) {

      this.bsModalRef.hide()

      this._bsModalSvc.show(ModalCreateEstablishmentComponent, {
        initialState: { title: 'Criar estabelecimento' },
        class: 'modal-lg',
      })
    }
  }


}