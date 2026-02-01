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
import { EMPTY, finalize, map, Observable, of, switchMap, tap } from 'rxjs';
import { ModalSelectEstablishment } from '@shared/components/modals/modal-select-establishment/modal-select-establishment.component';
import { PreLogin } from '@shared/models/PreLogin';
import { UserCorpRelation } from 'app/enums/user-corp-relations.enum';
import { EnterpriseWithEstablishments } from '@shared/models/EnterpriseWithEstablishment';
import { Enterprise } from '@shared/models/Enterprise';
import { ModalSelectEnterpriseComponent } from '@shared/components/modals/modal-select-enterprise/modal-select-enterprise.component';
import { Establishment } from '@shared/models/Establishment';
import { EnterpriseService } from '@shared/services/enterprise.service';
@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})

export class LoginComponent {
  constructor(
    private readonly _authService: AuthService,
    private readonly _toastr: ToastrService,
    private readonly _route: Router,
    private readonly _bsModalService: BsModalService,
    private readonly _corporationService : UserCorporationService,
    private readonly _enterpriseService: EnterpriseService
  ){}
  
  loadingLogin = false;
  email: string;
  password: string;

  formValido(email: string, password: string): boolean {
    if (!email || !password) {
      this._toastr.warning('Preencha todas as informações', 'Atenção');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailValido = emailRegex.test(email);

    if (!isEmailValido) {
      this._toastr.warning('Insira um e-mail válido', 'Atenção');
      return false;
    }

    return true;
  }

  tryLogin() {
    if (!this.formValido(this.email, this.password)) return

    this.loadingLogin = true;

    const dataToSend: PreLogin = {
      email: this.email,
      password: this.password
    };


    this._authService.preLogin(dataToSend)
    .pipe(
      finalize(()=>{
        this.loadingLogin = false
      }),
      switchMap(
        ()=> this.getUserCorp()
      ),
      switchMap(corps => {
        if (!corps.length) {
          this._toastr.info('Verifique com seu mecânico', 'Seu usuário não está vinculado a uma empresa')
          return EMPTY
        }
        if (this.haveMultiTenant(corps)) {
          return this.openSelectEntepriseModal(corps);
        }
      
        return of(corps[0]);
      }),
      switchMap(selectedEnterprise => {
        if (!selectedEnterprise) return EMPTY // IF NO ENTERPRISE IS SELECTED

        const idEtp = selectedEnterprise.id

        return this.getEstablishmentsForEnterprise(idEtp)
      }),
      switchMap(establishments => {
        if( establishments.length > 1 ) return this.openSelectEstablishmentModal(establishments)
        else return of (establishments[0])
      }),
      switchMap(establishmentSelected => {
        if(!establishmentSelected) return EMPTY // IF NO ESTABLISHMENT IS SELECTED

        const idEstablishmentSelected = establishmentSelected.id

        const dataToLogin = {tenantId: idEstablishmentSelected, ...dataToSend}

        return this._authService.login(dataToLogin)
      })
    )
    .subscribe({
      error: ()=> {
        this._toastr.error('Credenciais inválidas', 'Verifique as informações')
      }
    }
    );
  }

  getUserCorp(): Observable<Enterprise[]> {
    return this._corporationService.getUserCorporation()
  }

  getEstablishmentsForEnterprise(idEtp): Observable<Establishment[]> {
    return this._enterpriseService.getEstablishmentsForEnterprise(idEtp)
  }

  haveMultiTenant(corp: Enterprise[]): boolean {
    return corp.length > 1
  }

  openSelectEntepriseModal( enterprises: Enterprise[]): Observable<Enterprise> {

    this.loadingLogin = true;

    const modalRef = this._bsModalService.show(
      ModalSelectEnterpriseComponent,
      {
        initialState: {
          title: 'Empresas que você possui cadastro',
          corps: enterprises
        },
        class: 'modal-md'
      }
    );

    modalRef.onHidden?.subscribe(() => {
      this.loadingLogin = false;
    })

    return modalRef.content.onClose.pipe(
      finalize(() => {
        this.loadingLogin = false;
      })
    );
  }

  openSelectEstablishmentModal( est: Establishment[]): Observable<Establishment> {

    this.loadingLogin = true;

    const modalRef = this._bsModalService.show(
      ModalSelectEstablishment,
      {
        initialState: {
          title: 'Selecione o estabelecimento',
          establishments: est
        },
        class: 'modal-md'
      }
    );

    modalRef.onHidden?.subscribe(() => {
      this.loadingLogin = false;
    })

    return modalRef.content.onClose.pipe(
      finalize(() => {
        this.loadingLogin = false;
      })
    );
  }


}


