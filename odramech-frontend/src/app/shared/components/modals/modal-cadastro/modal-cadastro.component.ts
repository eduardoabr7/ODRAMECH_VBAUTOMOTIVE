import { Component, OnInit } from '@angular/core';
import { BsModalRef } from 'ngx-bootstrap/modal';

@Component({
  selector: 'app-modal-cadastro',
  standalone: true,
  templateUrl: './modal-cadastro.component.html'
})
export class ModalCadastroComponent implements OnInit {
  title?: string;
  message?: string;

  constructor(
    private bsModalRef: BsModalRef
  ) { }

  ngOnInit(): void {
  }
}