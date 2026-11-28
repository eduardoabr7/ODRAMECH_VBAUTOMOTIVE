import { Component, ElementRef, EventEmitter, Output, ViewChild, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { NestAPI } from '@shared/services/nest-api.service';
import { AuthService } from '@shared/services/auth.service';

/**
 * Primeiro acesso: troca obrigatória da senha provisória (definida por quem cadastrou).
 * Não fecha: sem trocar, o backend recusa tudo (403 PASSWORD_CHANGE_REQUIRED). Dá só para sair.
 */
@Component({
  selector: 'app-first-password-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="fp-backdrop">
    <form class="fp-card" role="dialog" aria-modal="true" aria-labelledby="fp-title" (ngSubmit)="save()" autocomplete="off">
      <div class="fp-icon"><i class="fa-solid fa-key"></i></div>
      <h2 id="fp-title">Crie a sua senha</h2>
      <p class="fp-sub">Este é o seu primeiro acesso. Troque a senha provisória que você recebeu por uma só sua.</p>

      <label class="fp-field">
        <span>Nova senha</span>
        <div class="fp-input">
          <input #first class="input" [type]="show ? 'text' : 'password'" name="newPassword" [(ngModel)]="newPassword"
            autocomplete="new-password" maxlength="72" required>
          <button type="button" class="fp-eye" (click)="show = !show" [attr.aria-label]="show ? 'Esconder senha' : 'Mostrar senha'">
            <i class="fa-regular" [class.fa-eye]="!show" [class.fa-eye-slash]="show"></i>
          </button>
        </div>
      </label>

      <label class="fp-field">
        <span>Confirme a nova senha</span>
        <input class="input" [type]="show ? 'text' : 'password'" name="confirmPassword" [(ngModel)]="confirmPassword"
          autocomplete="new-password" maxlength="72" required>
      </label>

      <ul class="fp-rules">
        <li [class.ok]="newPassword.length >= 8"><i class="fa-solid" [class.fa-check]="newPassword.length >= 8" [class.fa-circle]="newPassword.length < 8"></i> Pelo menos 8 caracteres</li>
        <li [class.ok]="hasLetter"><i class="fa-solid" [class.fa-check]="hasLetter" [class.fa-circle]="!hasLetter"></i> Pelo menos uma letra</li>
        <li [class.ok]="hasNumber"><i class="fa-solid" [class.fa-check]="hasNumber" [class.fa-circle]="!hasNumber"></i> Pelo menos um número</li>
        <li [class.ok]="matches"><i class="fa-solid" [class.fa-check]="matches" [class.fa-circle]="!matches"></i> As duas senhas iguais</li>
      </ul>

      <p class="fp-error" *ngIf="error" role="alert">{{ error }}</p>

      <button type="submit" class="btn-x btn-solid fp-save" [disabled]="!valid || saving">
        <span class="spinner-x" *ngIf="saving"></span> Salvar nova senha
      </button>
      <button type="button" class="btn-x btn-ghost fp-out" (click)="logout()" [disabled]="saving">Sair</button>
    </form>
  </div>
  `,
  styles: [`
    .fp-backdrop { position: fixed; inset: 0; z-index: 2000; display: grid; place-items: center; padding: 16px; background: rgba(10, 10, 12, .55); backdrop-filter: blur(3px); }
    .fp-card { width: min(420px, 100%); display: flex; flex-direction: column; gap: 14px; padding: 28px 26px 22px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); box-shadow: var(--shadow-3); animation: rise var(--dur-3) var(--ease-out) both; }
    .fp-icon { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); font-size: 18px; }
    h2 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
    .fp-sub { margin: -6px 0 2px; font-size: 13.5px; color: var(--muted); }
    .fp-field { display: flex; flex-direction: column; gap: 6px; margin: 0; font-size: 13px; color: var(--ink-2); font-weight: 500; }
    .fp-input { position: relative; .input { width: 100%; padding-right: 40px; } }
    .fp-eye { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; border: 0; background: transparent; color: var(--muted); cursor: pointer; border-radius: 6px; }
    .fp-rules { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 12.5px; color: var(--muted);
      li { display: flex; align-items: center; gap: 6px; } i { font-size: 9px; } li.ok { color: var(--ok); } li.ok i { font-size: 11px; } }
    .fp-error { margin: 0; padding: 9px 12px; border-radius: var(--r-sm); background: var(--danger-soft); color: var(--danger); font-size: 13px; }
    .fp-save { width: 100%; height: 40px; margin-top: 4px; }
    .fp-out { align-self: center; }
    @media (max-width: 420px) { .fp-rules { grid-template-columns: 1fr; } }
  `],
})
export class FirstPasswordModalComponent implements AfterViewInit {
  private readonly api = inject(NestAPI);
  private readonly auth = inject(AuthService);
  private readonly toastr = inject(ToastrService);

  @Output() done = new EventEmitter<void>();
  @ViewChild('first') first?: ElementRef<HTMLInputElement>;

  newPassword = '';
  confirmPassword = '';
  show = false;
  saving = false;
  error: string | null = null;

  get hasLetter() { return /[A-Za-z]/.test(this.newPassword); }
  get hasNumber() { return /\d/.test(this.newPassword); }
  get matches() { return !!this.newPassword && this.newPassword === this.confirmPassword; }
  get valid() { return this.newPassword.length >= 8 && this.hasLetter && this.hasNumber && this.matches; }

  ngAfterViewInit(): void { setTimeout(() => this.first?.nativeElement.focus()); }

  save(): void {
    if (!this.valid || this.saving) return;
    this.saving = true;
    this.error = null;
    this.api.post('auth/change-password', { newPassword: this.newPassword, confirmPassword: this.confirmPassword }).subscribe({
      next: () => {
        this.newPassword = this.confirmPassword = '';
        // recarrega a sessão: a flag some e o sistema libera
        this.auth.refreshAuthContext().subscribe({
          next: () => { this.saving = false; this.toastr.success('Senha criada. Bem-vindo!'); this.done.emit(); },
          error: () => { this.saving = false; this.done.emit(); },
        });
      },
      error: err => {
        this.saving = false;
        // erro de validação vem em `errors` (lista); os demais, em `message`
        const detail = err?.error?.errors?.[0]?.constraints;
        const m = detail ? Object.values(detail)[0] : err?.error?.message;
        this.error = typeof m === 'string' ? m : 'Não foi possível salvar a nova senha.';
      },
    });
  }

  logout(): void { this.auth.logout().subscribe(); }
}
