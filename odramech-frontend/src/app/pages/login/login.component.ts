import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { env } from '../../../environments/environment'
import { FormsModule } from '@angular/forms';
import { AuthService } from '@shared/services/auth.service';
import { LoginData } from '@shared/models/LoginData';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { BsModalService } from 'ngx-bootstrap/modal';
import { ModalCreateEnterprise } from '@shared/components/modals/modal-create-enterprise/modal-create-enterprise.component';
import { UserLogged } from '@shared/models/UserLogged';
import { UserCorporationService } from '@shared/services/user-corporation.service';
import { of, switchMap, tap } from 'rxjs';
import { ModalSelectEstablishment } from '@shared/components/modals/modal-select-establishment/modal-select-establishment.component';
@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})

export class LoginComponent implements OnInit {
  constructor(
    private readonly _authService: AuthService,
    private readonly _toastr: ToastrService,
    private readonly _route: Router,
    private readonly _bsModalService: BsModalService,
    private readonly _corporationService : UserCorporationService
  ){}
  
  nomeEstabelecimento: any;
  loadingLogin = false;
  email: string;
  username: string;
  password: string;
  dataUserOrEmail: string;
  dataToSend: LoginData;

  ngOnInit(): void {
    this.nomeEstabelecimento = env.nomeEstabelecimento;
  }

  
  tryLogin() {
    this.loadingLogin = true;

    if (!this.dataUserOrEmail || !this.password) {
      this.loadingLogin = false;
      this._toastr.warning('Preencha todas as informações', 'Acesso negado');
      return;
    }

    const isEmail = this.dataUserOrEmail.includes('@');

    this.dataToSend = {
      [isEmail ? 'email' : 'username']: this.dataUserOrEmail,
      password: this.password
    };

    this._authService.login(this.dataToSend).pipe(

      switchMap((user: UserLogged) =>
        this._corporationService.getUserCorporation(user.id).pipe(

          switchMap(corporationsRaw => {

            let userCorporations = corporationsRaw;


            // mocks para teste
            //nenhuma empresa, deve abrir modal de criar empresa
            // userCorporations = [];

            //vários estabelecimentos, deve abrir modal de seleção
            // userCorporations = [
            //   {
            //     establishments: [
            //       {
            //         id: 1,
            //         name: 'VB-Automotive',
            //         email: 'eduardopradoabreu@gmail.com'
            //       },
            //       {
            //         id: 2,
            //         name: 'VB-Automotive Unidade POA',
            //         email: 'eduardopradoabreu@gmail.com'
            //       }
            //     ]
            //   }
            // ];

            // apenas 1 estabelecimento ⇒ deve ir pro home
            // userCorporations = [
            //   {
            //     establishments: [
            //       {
            //         id: 1,
            //         name: 'VB-Automotive',
            //         email: 'eduardopradoabreu@gmail.com'
            //       }
            //     ]
            //   }
            // ];

            if (user.id === 1 && userCorporations.length === 0) {
              return this.openCreateEnterpriseModal(user.id);
            }

            if (userCorporations[0].establishments.length > 1) {
              return this.openSelectEstablishmentModal();
            }

            this._route.navigateByUrl('/home');
            return of(null);
          })
        )
      ),

      tap(() => this.loadingLogin = false)

    ).subscribe({
      next: () => {},
      error: () => {
        this.loadingLogin = false;
        this._toastr.error('Credenciais inválidas', 'Acesso negado');
      }
    });
  }

  async openCreateEnterpriseModal(idUser?: number) {
    const modalRef = this._bsModalService.show(ModalCreateEnterprise, {
      initialState: { 
        title: 'Criar empresa', 
        withCreateEstablisment: true,
        userId: idUser
      },
      class: 'modal-lg'
    });

    modalRef.onHidden?.subscribe(() => { // quando fecha no esc ou clicando no backdrop
      this.loadingLogin = false;
    });

    const result = await modalRef.content.onHide()

    if(!!result){
      this._route.navigateByUrl('/home');
      this._toastr.success('Empresa criada', 'Sucesso')
    }
  }

  openSelectEstablishmentModal() {
    const modalRef = this._bsModalService.show(ModalSelectEstablishment, {
      initialState: { title: 'Estabelecimento' },
      class: 'modal-lg'
    });

    modalRef.onHidden?.subscribe(() => {
      this.loadingLogin = false;
    });

    return modalRef.content.onClose.asObservable();
  }


}


