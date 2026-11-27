import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ToastrService } from 'ngx-toastr';
import { NestAPI } from '@shared/services/nest-api.service';
import { SessionService } from '@shared/services/session.service';
import { AuthService } from '@shared/services/auth.service';

interface MailSettingsView {
  settings: {
    enabled: boolean; host: string; port: number; secure: boolean; username: string | null; hasPassword: boolean;
    fromName: string | null; fromEmail: string; verifiedAt: string | null; lastError: string | null; updatedAt: string;
  } | null;
  fallback: { fromEmail: string; configured: boolean };
}

interface Preset { name: string; host: string; port: number; secure: boolean; hint: string }

const PRESETS: Preset[] = [
  { name: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 587, secure: false, hint: 'Use uma "senha de app" (Conta Google → Segurança → Senhas de app).' },
  { name: 'Outlook / Microsoft 365', host: 'smtp.office365.com', port: 587, secure: false, hint: 'A conta precisa ter "SMTP autenticado" liberado no Microsoft 365.' },
  { name: 'Zoho Mail', host: 'smtp.zoho.com', port: 465, secure: true, hint: 'Use uma senha de aplicativo do Zoho.' },
  { name: 'Hostinger', host: 'smtp.hostinger.com', port: 465, secure: true, hint: 'Usuário = e-mail completo criado no painel.' },
  { name: 'Locaweb', host: 'email-ssl.com.br', port: 465, secure: true, hint: 'Usuário = e-mail completo.' },
  { name: 'Outro', host: '', port: 587, secure: false, hint: 'Pegue servidor, porta e segurança com seu provedor de e-mail.' },
];

/** Configurações → E-mail de envio (SMTP próprio da empresa). */
@Component({
  selector: 'app-mail-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './mail-settings.component.html',
  styleUrl: './mail-settings.component.scss',
})
export class MailSettingsComponent implements OnInit {
  private readonly api = inject(NestAPI);
  private readonly toastr = inject(ToastrService);
  readonly isManager = toSignal(inject(SessionService).isManager$, { initialValue: false });
  private readonly myEmail = toSignal(inject(AuthService).user$, { initialValue: null });

  readonly PRESETS = PRESETS;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly testing = signal(false);
  readonly view = signal<MailSettingsView | null>(null);
  readonly dirty = signal(false);

  // formulário
  enabled = false;
  preset = 'Outro';
  host = '';
  port = 587;
  secure = false;
  username = '';
  password = '';
  changePassword = false;
  fromName = '';
  fromEmail = '';
  testTo = '';

  readonly hasPassword = computed(() => !!this.view()?.settings?.hasPassword);
  get presetHint(): string { return PRESETS.find(p => p.name === this.preset)?.hint ?? ''; }

  ngOnInit(): void {
    this.api.get<MailSettingsView>('settings/mail').subscribe({
      next: v => { this.apply(v); this.loading.set(false); },
      error: err => { this.loading.set(false); this.toastr.error(err?.error?.message ?? 'Não foi possível carregar.'); },
    });
  }

  private apply(v: MailSettingsView): void {
    this.view.set(v);
    const s = v.settings;
    this.enabled = s?.enabled ?? false;
    this.host = s?.host ?? '';
    this.port = s?.port ?? 587;
    this.secure = s?.secure ?? false;
    this.username = s?.username ?? '';
    this.fromName = s?.fromName ?? '';
    this.fromEmail = s?.fromEmail ?? '';
    this.password = '';
    this.changePassword = !s?.hasPassword;
    this.preset = PRESETS.find(p => p.host && p.host === this.host)?.name ?? 'Outro';
    this.testTo = this.testTo || this.myEmail()?.user?.email || '';
    this.dirty.set(false);
  }

  touch(): void { this.dirty.set(true); }

  pickPreset(name: string): void {
    this.preset = name;
    const p = PRESETS.find(x => x.name === name);
    if (p && p.host) { this.host = p.host; this.port = p.port; this.secure = p.secure; }
    this.touch();
  }

  /** porta comum ajusta a segurança sozinha (465 = SSL; 587/25 = STARTTLS) */
  portChanged(): void {
    if (this.port === 465) this.secure = true;
    if (this.port === 587 || this.port === 25) this.secure = false;
    this.touch();
  }

  private payload() {
    return {
      enabled: this.enabled,
      host: this.host.trim(),
      port: Number(this.port),
      secure: this.secure,
      username: this.username.trim() || null,
      ...(this.changePassword && { password: this.password }),
      fromName: this.fromName.trim() || null,
      fromEmail: this.fromEmail.trim(),
    };
  }

  private valid(): boolean {
    if (!this.host.trim() || !this.fromEmail.trim() || !this.port) {
      this.toastr.warning('Preencha servidor, porta e e-mail do remetente.');
      return false;
    }
    return true;
  }

  save(): void {
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    this.api.put<MailSettingsView>('settings/mail', this.payload()).subscribe({
      next: v => {
        this.saving.set(false);
        this.apply(v);
        this.toastr.success(v.settings?.enabled ? 'Pronto: os e-mails agora saem pelo servidor da empresa.' : 'Salvo. Os e-mails continuam saindo pelo e-mail padrão do Odramech.');
      },
      error: err => { this.saving.set(false); this.toastr.error(errorText(err, 'Não foi possível salvar.')); },
    });
  }

  test(): void {
    if (!this.valid() || this.testing()) return;
    this.testing.set(true);
    this.api.post<{ ok: boolean; to: string }>('settings/mail/test', { ...this.payload(), to: this.testTo.trim() || undefined }).subscribe({
      next: r => {
        this.testing.set(false);
        this.toastr.success(`E-mail de teste enviado para ${r.to}. Confira a caixa de entrada (e o spam).`, 'Funcionou');
        if (!this.dirty()) this.ngOnInit();
      },
      error: err => { this.testing.set(false); this.toastr.error(errorText(err, 'O teste falhou.'), 'Teste falhou', { timeOut: 8000 }); },
    });
  }
}

function errorText(err: any, fallback: string): string {
  const first = err?.error?.errors?.[0]?.constraints;
  return first ? String(Object.values(first)[0]) : err?.error?.message ?? fallback;
}
