import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { env } from '../../../environments/environment'
import { FormsModule } from '@angular/forms';
import { AuthService } from '@shared/services/auth.service';
import { LoginData } from '@shared/models/LoginData';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { switchMap, tap } from 'rxjs';
import { UserLogged } from '@shared/models/UserLogged';
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
    private readonly _route: Router
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
            this._route.navigateByUrl('/home');
            this.loadingLogin = false;
        },
        error: (err: HttpErrorResponse) => {
            this.loadingLogin = false;
            this._toastr.error('Credenciais inválidas', 'Acesso negado');
        }
    });

  }



}


