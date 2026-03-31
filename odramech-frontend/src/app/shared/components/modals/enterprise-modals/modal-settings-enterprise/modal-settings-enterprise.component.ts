import { CommonModule } from '@angular/common';
import { Component, Type } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';

import { AuthService } from '@shared/services/auth.service';
import { AuthContext } from '@shared/models/AuthContext';
import { UserLogged } from '@shared/models/UserLogged';
import { BaseModalComponent } from '../../base-modal.component';
import { ModalViewEstablishmentsComponent } from '../../establishment-modals/modal-view-establishments/modal-view-establishments.component';
// import { ModalEstablishmentsComponent } from '../modal-establishments/modal-establishments.component';
// import { ModalPaymentMethodsComponent } from '../modal-payment-methods/modal-payment-methods.component';
// import { ModalUsersComponent } from '../modal-users/modal-users.component';

interface SettingCard {
  name: string;
  description: string;
  iconClass: string;
  iconColor: string;
  iconBg: string;
  openModal?: Type<any>;
}

@Component({
  selector: 'app-modal-settings-enterprise',
  imports: [CommonModule],
  templateUrl: './modal-settings-enterprise.component.html',
  styleUrl: './modal-settings-enterprise.component.scss'
})
export class ModalSettingsEnterpriseComponent extends BaseModalComponent {

  constructor(
    bsModalRef: BsModalRef,
    private readonly _modalService: BsModalService,
    private readonly _authservice: AuthService
  ) {
    super(bsModalRef);
  }

  userLogged: UserLogged | null = null;
  authContext: AuthContext | null = null;

  ngOnInit() {
    // get role context from user logged
    this._authservice.user$.subscribe(authCtx => {
      this.authContext = authCtx;
      this.userLogged = authCtx?.user ?? null;
    });

    

// authcontext {
//     "user": {
//         "id": 1,
//         "name": "Administrador",
//         "email": "odramechenterprise@gmail.com",
//         "principalPhone": "119999999",
//         "context": "AUTH"
//     },
//     "usercorp": {
//         "id": 1,
//         "logoUrl": null,
//         "name": "Empresa Genérica",
//         "establishment": {
//             "id": 1,
//             "logoUrl": null,
//             "name": "Estabelecimento Genérico",
//             "address": {
//                 "street": "Rua Exemplo",
//                 "number": "123",
//                 "city": "São Paulo"
//             },
//             "role": "ADMIN"
//         }
//     }
// }
  }

  cards: SettingCard[] = [
    {
      name: 'Estabelecimentos',
      description: 'Criar e gerenciar seus estabelecimentos',
      iconClass: 'fas fa-store',
      iconColor: '#4f6ef7',
      iconBg: '#eef1fe',
      openModal: ModalViewEstablishmentsComponent,
    },
    {
      name: 'Formas de Pagamento',
      description: 'Configurar métodos aceitos',
      iconClass: 'fas fa-credit-card',
      iconColor: '#16a34a',
      iconBg: '#dcfce7',
      // openModal: ModalPaymentMethodsComponent,
    },
  ];

  openCard(card: SettingCard): void {
    if (!card.openModal) return;

    this._modalService.show(card.openModal, {
      initialState: { title: card.name },
      class: 'modal-lg'
    });
  }
}