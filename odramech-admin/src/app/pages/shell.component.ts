import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Session } from '../core/api.service';

@Component({
  selector: 'adm-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="layout">
      <aside class="side">
        <div class="brand">
          <span class="mark"></span>
          <div><strong>Odramech</strong><span>Licenças</span></div>
        </div>
        <nav>
          <a routerLink="/" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }">Visão geral</a>
          <a routerLink="/licencas" routerLinkActive="on">Licenças</a>
          <a routerLink="/planos" routerLinkActive="on">Planos</a>
        </nav>
        <div class="me">
          <span class="who">{{ session.admin()?.name }}</span>
          <span class="mail">{{ session.admin()?.email }}</span>
          @if (!session.admin()?.totpEnabled) {
            <span class="no2fa" title="npm run admin:create -- --email … --totp">2FA desativado</span>
          }
          <button class="btn sm ghost out" (click)="logout()">Sair</button>
        </div>
      </aside>
      <main class="content"><router-outlet /></main>
    </div>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }
    .side { background: var(--sidebar); color: var(--on-dark); display: flex; flex-direction: column; padding: 18px 12px; position: sticky; top: 0; height: 100vh; }
    .brand { display: flex; align-items: center; gap: 10px; padding: 0 8px 18px; border-bottom: 1px solid var(--sidebar-line); }
    .brand strong { display: block; font-size: 15px; }
    .brand span { font-size: 12px; color: var(--on-dark-muted); }
    .mark { width: 30px; height: 30px; border-radius: 8px; background: #000; border: 1px solid var(--sidebar-line); position: relative; flex: none; }
    .mark::after { content: ''; position: absolute; left: 11px; top: 6px; width: 6px; height: 12px; border: solid var(--accent); border-width: 0 3px 3px 0; transform: rotate(40deg); }
    nav { display: grid; gap: 2px; margin-top: 14px; }
    nav a { padding: 8px 10px; border-radius: 7px; text-decoration: none; color: var(--on-dark-muted); font-weight: 500; transition: background .15s, color .15s; }
    nav a:hover { color: var(--on-dark); background: #1b1b1b; }
    nav a.on { color: #fff; background: #1f1f1f; box-shadow: inset 2px 0 0 var(--accent); }
    .me { margin-top: auto; display: grid; gap: 2px; padding: 12px 8px 0; border-top: 1px solid var(--sidebar-line); font-size: 12.5px; }
    .who { font-weight: 600; }
    .mail { color: var(--on-dark-muted); overflow: hidden; text-overflow: ellipsis; }
    .no2fa { color: #f0a37f; font-size: 11.5px; margin-top: 4px; }
    .out { color: var(--on-dark-muted); justify-self: start; margin-top: 8px; padding-left: 0; }
    .out:hover { color: #fff; background: transparent !important; }
    .content { padding: 28px 32px 48px; min-width: 0; max-width: 1180px; }
    @media (max-width: 820px) {
      .layout { grid-template-columns: 1fr; }
      .side { position: static; height: auto; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 16px; }
      .brand { border: 0; padding: 0; }
      nav { display: flex; margin: 0; }
      .me { margin: 0 0 0 auto; border: 0; padding: 0; }
      .who, .mail, .no2fa { display: none; }
      .out { margin: 0; }
      .content { padding: 20px 16px 40px; }
    }
  `,
})
export class ShellComponent {
  readonly session = inject(Session);
  private readonly router = inject(Router);

  async logout() {
    await this.session.logout();
    await this.router.navigateByUrl('/login');
  }
}
