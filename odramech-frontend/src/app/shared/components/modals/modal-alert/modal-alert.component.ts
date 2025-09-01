import { Component, OnInit } from '@angular/core';
import { BsModalRef } from 'ngx-bootstrap/modal';

@Component({
  selector: 'app-modal-alert',
  standalone: true,
  templateUrl: './modal-alert.component.html'
})
export class ModalAlertComponent implements OnInit {
  title?: string;
  message?: string;

  constructor(
    private bsModalRef: BsModalRef
  ) { }

  ngOnInit(): void {
  }
}