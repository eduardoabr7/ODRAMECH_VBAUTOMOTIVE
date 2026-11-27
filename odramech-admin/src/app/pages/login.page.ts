import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage, Session } from '../core/api.service';

@Component({
  selector: 'adm-login',
  imports: [FormsModule],
  template: `
    <main class="wrap">
      <form class="card box" (ngSubmit)="submit()" autocomplete="on">
        <div class="brand">
          <span class="mark"></span>
          <div>
            <strong>Odramech</strong>
            <span class="muted small">Painel de licenças</span>
          </div>
        </div>

        <label class="field">E-mail
          <input name="email" type="email" [(ngModel)]="email" autocomplete="username" required autofocus>
        </label>
        <label class="field">Senha
          <input name="password" type="password" [(ngModel)]="password" autocomplete="current-password" required>
        </label>
        @if (needsTotp()) {
          <label class="field">Código do autenticador
            <input name="totp" inputmode="numeric" maxlength="6" [(ngModel)]="totp" autocomplete="one-time-code" placeholder="000000" required>
          </label>
        }

        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }

        <button class="btn primary block" type="submit" [disabled]="busy() || !email || !password">
          {{ busy() ? 'Entrando…' : 'Entrar' }}
        </button>
        <p class="muted small foot">Acesso restrito ao administrador do sistema. Todas as ações ficam registradas.</p>
      </form>
    </main>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 16px;
      background: radial-gradient(1200px 500px at 50% -10%, #fff 0, var(--bg) 60%); }
    .box { width: 100%; max-width: 380px; padding: 28px; display: grid; gap: 14px; }
    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
    .brand strong { display: block; font-size: 17px; }
    .mark { width: 34px; height: 34px; border-radius: 9px; background: var(--sidebar); position: relative; }
    .mark::after { content: ''; position: absolute; inset: 10px 9px 12px 10px; border: solid var(--accent); border-width: 0 3px 3px 0; transform: rotate(40deg) translate(-1px, -2px); width: 7px; }
    .block { width: 100%; height: 38px; }
    .err { margin: 0; padding: 9px 12px; border-radius: var(--r); background: var(--danger-soft); color: var(--danger); font-size: 13px; }
    .foot { margin: 0; text-align: center; }
  `,
})
export class LoginPage {
  private readonly session = inject(Session);
  private readonly router = inject(Router);

  email = '';
  password = '';
  totp = '';
  readonly needsTotp = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async submit() {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.session.login(this.email, this.password, this.needsTotp() ? this.totp : undefined);
      await this.router.navigateByUrl('/');
    } catch (err) {
      const e = err as HttpErrorResponse;
      if (e.status === 401 && e.error?.code === 'TOTP_REQUIRED') {
        this.needsTotp.set(true);
        this.error.set(null);
      } else {
        this.error.set(errorMessage(err));
        this.totp = '';
      }
    } finally {
      this.busy.set(false);
    }
  }
}
