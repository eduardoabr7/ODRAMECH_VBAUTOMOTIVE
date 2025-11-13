import { Component } from '@angular/core';
import { BaseModalComponent } from '../base-modal.component';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

@Component({
  selector: 'app-modal-select-establishment',
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './modal-select-establishment.component.html',
  styleUrl: './modal-select-establishment.component.scss'
})
export class ModalSelectEstablishment extends BaseModalComponent {
  constructor(bsModalRef: BsModalRef) {
      super(bsModalRef);
  }
  
  teste(){
    console.log('a')
  }

  listaEstabelecimentos = [
    { id: 1, nome: 'Estabelecimento A' },
    { id: 2, nome: 'Estabelecimento B' },
    { id: 3, nome: 'Estabelecimento C' }
  ];

  estabelecimentoSelecionado: any;
}
