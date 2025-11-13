import { Component, OnInit } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { BaseModalComponent } from '../base-modal.component';

@Component({
  selector: 'app-modal-alert',
  templateUrl: './modal-alert.component.html',
  styleUrls: ['./modal-alert.component.scss']
})
export class ModalAlertComponent extends BaseModalComponent {
  constructor(bsModalRef: BsModalRef) {
      super(bsModalRef);
  }

  ngOnInit(): void {
  }
}