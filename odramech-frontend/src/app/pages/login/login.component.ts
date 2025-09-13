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
import { ModalUserCorporationComponent } from '@shared/components/modals/modal-user-corporation/modal-user-corporation.component';
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
    private readonly _bsModalService: BsModalService
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

  
  async tryLogin(){
    this.loadingLogin = true;

    if(!this.dataUserOrEmail || !this.password){
      this.loadingLogin = false;
      return
    }

    const isEmail = this.dataUserOrEmail.includes('@')

    this.dataToSend = {
      [isEmail ? 'email' : 'username']: this.dataUserOrEmail,
      password: this.password
    };

    this._authService.login(this.dataToSend).subscribe({
        next: () => {
            //this._route.navigateByUrl('/home');

            const modalRef = this._bsModalService.show(ModalUserCorporationComponent, {
              initialState: {
                title: 'Criar matriz',
              },
              class: 'modal-sm'
            });

            // Opcional: para saber quando o modal foi fechado
            modalRef.onHidden?.subscribe(() => {
              this.loadingLogin = false;
            });
        },
        error: (err: HttpErrorResponse) => {
            this.loadingLogin = false;
            if (err.status !== 0) {
                this._toastr.error('Credenciais inválidas', 'Acesso negado');
            }
        }
    });

  }



}


