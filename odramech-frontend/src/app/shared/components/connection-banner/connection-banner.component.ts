import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ConnectionService, ConnectionState } from '@shared/services/connection.service';

/** Aviso flutuante de conexão: aparece quando o backend cai e some ao reconectar. */
@Component({
  selector: 'app-connection-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="conn-banner" *ngIf="visible" [class.ok]="justReconnected" role="status" aria-live="polite">
      <ng-container *ngIf="!justReconnected">
        <span class="pulse"></span>
        <div class="txt">
          <strong>Sem conexão com o servidor</strong>
          <span *ngIf="state === 'checking'">Tentando reconectar…</span>
          <span *ngIf="state === 'offline'">Nova tentativa em {{ retryIn }}s</span>
        </div>
        <button type="button" (click)="retry()" [disabled]="state === 'checking'">
          <span class="spin" *ngIf="state === 'checking'"></span>
          <ng-container *ngIf="state !== 'checking'">Tentar agora</ng-container>
        </button>
      </ng-container>
      <ng-container *ngIf="justReconnected">
        <i class="fa-solid fa-check"></i>
        <div class="txt"><strong>Conexão restabelecida</strong><span>Dados atualizados.</span></div>
      </ng-container>
    </div>
  `,
  styles: [`
    .conn-banner {
      position: fixed; left: 50%; bottom: 24px; z-index: 2000;
      transform: translateX(-50%);
      display: flex; align-items: center; gap: 12px;
      min-width: 320px; max-width: calc(100vw - 32px);
      padding: 10px 10px 10px 16px;
      background: var(--ink); color: #fff;
      border: 1px solid #2a2a2a; border-radius: 14px;
      box-shadow: var(--shadow-3);
      animation: slideUp 420ms var(--ease-out) both;
      font-size: 13px;
    }
    .conn-banner.ok { padding-right: 16px; }
    .txt { display: flex; flex-direction: column; line-height: 1.3; flex: 1; }
    .txt strong { font-weight: 600; }
    .txt span { color: #a7a59f; font-size: 12px; font-variant-numeric: tabular-nums; }
    .pulse { width: 9px; height: 9px; border-radius: 50%; background: #ff6b5e; color: #ff6b5e; animation: pulse-dot 1.6s ease-out infinite; flex-shrink: 0; }
    .ok i { width: 22px; height: 22px; border-radius: 50%; background: #4fd08b; color: #0b2a19; display: grid; place-items: center; font-size: 11px; animation: pop 400ms var(--ease-spring); }
    button {
      height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid #333;
      background: #1f1f1f; color: #fff; font-size: 12.5px; font-weight: 500; cursor: pointer; min-width: 104px;
      display: inline-grid; place-items: center; transition: background 140ms;
    }
    button:hover:not([disabled]) { background: #2a2a2a; }
    .spin { width: 13px; height: 13px; border-radius: 50%; border: 2px solid #fff; border-right-color: transparent; animation: spin .7s linear infinite; }
    @keyframes slideUp { from { opacity: 0; transform: translate(-50%, 16px); } to { opacity: 1; transform: translate(-50%, 0); } }
  `],
})
export class ConnectionBannerComponent implements OnInit, OnDestroy {
  state: ConnectionState = 'online';
  retryIn = 0;
  justReconnected = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly subs = new Subscription();

  constructor(private readonly _conn: ConnectionService) {}

  get visible(): boolean { return this.state !== 'online' || this.justReconnected; }

  ngOnInit(): void {
    this.subs.add(this._conn.state$.subscribe(s => {
      if (s !== 'online') { this.justReconnected = false; if (this.hideTimer) clearTimeout(this.hideTimer); }
      this.state = s;
    }));
    this.subs.add(this._conn.nextRetryIn$.subscribe(n => this.retryIn = n));
    this.subs.add(this._conn.reconnected$.subscribe(() => {
      this.justReconnected = true;
      this.hideTimer = setTimeout(() => this.justReconnected = false, 2600);
    }));
  }

  retry(): void { this._conn.retryNow(); }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.hideTimer) clearTimeout(this.hideTimer);
  }
}
