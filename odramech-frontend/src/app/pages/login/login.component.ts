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

    const dataToSend: LoginData = {
      email: this.email,
      password: this.password
    };


    this._authService.login(dataToSend)
    .pipe(
      finalize(()=>{
        this.loadingLogin = false
      }),
      switchMap(
        user => this.haveMultiTenant(user)
      ),
      tap(haveMt => {
        if (!haveMt) {
          this._route.navigateByUrl('/home');
        }
        else {
          this._bsModalService.show(ModalSelectEstablishment, {
            initialState: {
              title: 'Selecionar Estabelecimento'
            }
          })
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

  haveMultiTenant(user: UserLogged): Observable<boolean> {
    return this._corporationService.getUserCorporation(user.id).pipe(
      map(value => value.length > 1) // true se tiver mais de uma empresa
    );
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


