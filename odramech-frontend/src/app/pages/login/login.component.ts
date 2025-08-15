import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { env } from '../../../environments/environment'

@Component({
  selector: 'app-login',
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})

export class LoginComponent implements OnInit {
  
  nomeEstabelecimento: any;

  ngOnInit(): void {
    this.nomeEstabelecimento = env.nomeEstabelecimento;
  }
}


