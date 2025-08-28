import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { env } from '../../../environments/environment'
import { FormsModule } from '@angular/forms';
import { AuthService } from '@shared/services/auth.service';
import { LoginData } from '@shared/models/LoginData';
import { ToastrService } from 'ngx-toastr';
import { UserLogged } from '@shared/models/UserLogged';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
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

    if(!this.dataUserOrEmail || !this.password) return

    const isEmail = this.dataUserOrEmail.includes('@')

    this.dataToSend = {
      [isEmail ? 'email' : 'username']: this.dataUserOrEmail,
      password: this.password
    };

    try{
      await this._authService.login(this.dataToSend)

      const userLogged : UserLogged = await this._authService.getUserLogged()

      this._toastr.info(`Usuário: ${userLogged.name}`);

      this._route.navigateByUrl('/home')

      this.loadingLogin = false;
    } catch(err) {
      this.loadingLogin = false;

      if (!(err instanceof HttpErrorResponse)) return;

      this._toastr.error('Credenciais inválidas', 'Acesso negado');
    }
  }



}


