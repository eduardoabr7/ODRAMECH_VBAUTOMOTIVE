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
import { finalize, map, Observable, of, switchMap, tap } from 'rxjs';
import { ModalSelectEstablishment } from '@shared/components/modals/modal-select-establishment/modal-select-establishment.component';
import { PreLogin } from '@shared/models/PreLogin';
import { UserCorpRelation } from 'app/enums/user-corp-relations.enum';
import { EnterpriseWithEstablishments } from '@shared/models/EnterpriseWithEstablishment';
import { Enterprise } from '@shared/models/Enterprise';
import { ModalSelectEnterpriseComponent } from '@shared/components/modals/modal-select-enterprise/modal-select-enterprise.component';
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
    private readonly _corporationService : UserCorporationService
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


    this._authService.validateUserCredentials(dataToSend)
    .pipe(
      finalize(()=>{
        this.loadingLogin = false
      }),
      switchMap(
        ()=> this.getUserCorp()
      ),
      tap(value => {
        if(this.haveMultiTenant(value)){
          this.openSelectEntepriseModal(value)
        }

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

  haveMultiTenant(corp: Enterprise[]): boolean {
    return corp.length > 1
  }

  openSelectEntepriseModal(enterprises: Enterprise[]) {
    this.loadingLogin = true;
    const modalRef = this._bsModalService.show(ModalSelectEnterpriseComponent, {
      initialState: {
        title: 'Empresas que você possui cadastro',
        corps: enterprises
      },
      class: 'modal-md'
    })

    modalRef.onHidden?.subscribe(() => {
      this.loadingLogin = false;
    })
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


