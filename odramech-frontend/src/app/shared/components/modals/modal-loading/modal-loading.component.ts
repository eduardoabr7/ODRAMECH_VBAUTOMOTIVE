import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { BsModalRef, BsModalService, ModalOptions } from 'ngx-bootstrap/modal';

@Component({
  selector: 'app-modal-loading',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-loading.component.html',
  styleUrl: './modal-loading.component.scss'
})
export class ModalLoadingComponent {

  @Input() title: string = 'Aguarde...';
  @Input() subtitle: string = 'Processando sua solicitação';

  static open(
    modalService: BsModalService,
    title: string = 'Aguarde...',
    subtitle: string = 'Processando sua solicitação'
  ): BsModalRef {
    const config: ModalOptions = {
      initialState: { title, subtitle },
      backdrop: 'static',
      keyboard: false,
      class: 'modal-loading-wrap',
      animated: true,
    };

    return modalService.show(ModalLoadingComponent, config);
  }
}