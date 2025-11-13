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
import { CorporationService } from '@shared/services/corporation.service';
import { switchMap } from 'rxjs';
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
    private readonly _corporationService : CorporationService
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
        next: () => { // se autenticar segue aqui

            let userId: number

            this._authService.getUserLogged().pipe(
              switchMap((user: UserLogged) => {
                userId = user.id
                return this._corporationService.getUserCorporation(userId);
              })
            ).subscribe(dataReceived => {

              let userCorporations = dataReceived; 


              // para fins de testes com cad_empresa
              // userCorporations = [
              //   {
              //     establishments: [
              //       {
              //         id: 1,
              //         name: 'VB-Automotive',
              //         email: 'eduardopradoabreu@gmail.com'
              //       },
              //       // {
              //       //   id: 2,
              //       //   name: 'VB-Automotive Unidade POA',
              //       //   email: 'eduardopradoabreu@gmail.com'
              //       // }                    
              //     ]
              //   },
              // ]

              if (userId === 1 && userCorporations.length === 0) { // se o usuário for admin e não tiver nenhuma empresa vinculada a ele (implementação do zero)

                const modalRef = this._bsModalService.show(ModalCreateEnterprise, {
                  initialState: {
                    title: 'Criar empresa'
                  },
                  class: 'modal-lg'
                });

                // Opcional: para saber quando o modal foi fechado
                modalRef.onHidden?.subscribe(() => {
                  this.loadingLogin = false;
                });
              } else if (userCorporations[0].establishments.length > 1) { // se possuir cadastro em mais de um estabelecimento, abre a modal para escolher em qual deseja se logar
                const modalRef = this._bsModalService.show(ModalSelectEstablishment, {
                  initialState: {
                    title: 'Estabelecimento'
                  },
                  class: 'modal-lg'
                })

              } else {
                this.loadingLogin = false;
                this._route.navigateByUrl('/home')
              }
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


