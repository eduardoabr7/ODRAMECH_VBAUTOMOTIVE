import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { env } from '../../../environments/environment'
import { FormsModule } from '@angular/forms';
import { AuthService } from '@shared/services/auth.service';
import { LoginData } from '@shared/models/LoginData';
@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})

export class LoginComponent implements OnInit {
  constructor(
    private readonly _authService: AuthService
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

  
  async retryLogin(){
    this.loadingLogin = true;

    if(!this.dataUserOrEmail || !this.password) return

    const isEmail = this.dataUserOrEmail.includes('@')

    this.dataToSend = {
      [isEmail ? 'email' : 'username']: this.dataUserOrEmail,
      password: this.password
    };

    await this._authService.login(this.dataToSend)
  }



}


