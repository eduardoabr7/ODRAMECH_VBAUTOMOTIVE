import { Component, OnInit } from '@angular/core';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { BaseModalComponent } from '../base-modal.component';

@Component({
  selector: 'app-modal-user-corporation',
  templateUrl: './modal-user-corporation.component.html',
  styleUrl: './modal-user-corporation.component.scss'
})
export class ModalUserCorporationComponent extends BaseModalComponent implements OnInit {

  constructor(bsModalRef: BsModalRef) {
    super(bsModalRef);
  }

  ngOnInit(): void {

  }

  closeModal(){
    this.hideModal()
  }

}