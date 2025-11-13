import { Component, OnInit } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { BaseModalComponent } from '../base-modal.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal-create-enterprise',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-create-enterprise.component.html',
  styleUrls: ['./modal-create-enterprise.component.scss']
})
export class ModalCreateEnterprise extends BaseModalComponent {
  
  constructor(bsModalRef: BsModalRef) {
      super(bsModalRef);
  }

  name: string;
  email: string;
  imageUrl: string;

  ngOnInit() {
  }

  prosseguir() {
    console.log('dados de cadastro de empresa: ')
    console.log(this.name)
    console.log(this.email)
  }

}