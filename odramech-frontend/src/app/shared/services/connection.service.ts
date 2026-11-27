import { Inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Subject } from 'rxjs';
import { NestAPI } from './nest-api.service';

export type ConnectionState = 'online' | 'offline' | 'checking';

/** Intervalos (s) entre tentativas: começa rápido e estabiliza em 15s. */
const BACKOFF = [1, 2, 3, 5, 8, 13, 15];

/**
 * Monitora a conexão com o backend.
 * - Qualquer requisição que falhe por rede (status 0) chama markOffline().
 * - A partir daí tenta GET /health com backoff até voltar.
 * - Ao voltar, emite reconnected$ para a aplicação revalidar sessão e recarregar dados.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionService {
  private readonly _state = new BehaviorSubject<ConnectionState>('online');
  readonly state$ = this._state.asObservable();

  private readonly _nextRetryIn = new BehaviorSubject<number>(0);
  readonly nextRetryIn$ = this._nextRetryIn.asObservable();

  /** emite uma vez a cada reconexão bem‑sucedida */
  readonly reconnected$ = new Subject<void>();

  /** rota que o usuário tentou abrir enquanto o servidor estava fora */
  pendingUrl: string | null = null;

  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private readonly isBrowser: boolean;

  constructor(
    private readonly _api: NestAPI,
    private readonly _zone: NgZone,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      window.addEventListener('online', () => this.isOffline && this.retryNow());
      window.addEventListener('offline', () => this.markOffline());
    }
  }

  get isOffline(): boolean { return this._state.value !== 'online'; }

  markOffline(): void {
    if (!this.isBrowser || this.isOffline) return;
    this.attempt = 0;
    this._state.next('offline');
    this.schedule();
  }

  retryNow(): void {
    if (!this.isBrowser || !this.isOffline) return;
    this.clearTimers();
    this.check();
  }

  private schedule(): void {
    this.clearTimers();
    const wait = BACKOFF[Math.min(this.attempt, BACKOFF.length - 1)];
    this._nextRetryIn.next(wait);

    // timers fora da zona do Angular: não disparam change detection a cada segundo à toa
    this._zone.runOutsideAngular(() => {
      this.tickTimer = setInterval(() => {
        const left = Math.max(0, this._nextRetryIn.value - 1);
        this._zone.run(() => this._nextRetryIn.next(left));
      }, 1000);
      this.retryTimer = setTimeout(() => this._zone.run(() => this.check()), wait * 1000);
    });
  }

  private async check(): Promise<void> {
    this.clearTimers();
    this._state.next('checking');
    this.attempt++;

    const ok = await this.ping();
    if (ok) {
      this.attempt = 0;
      this._state.next('online');
      this.reconnected$.next();
    } else {
      this._state.next('offline');
      this.schedule();
    }
  }

  /** fetch direto (sem HttpClient) para não passar pelos interceptors e não gerar loop */
  private async ping(): Promise<boolean> {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 4000);
    try {
      const res = await fetch(this._api.url('health'), { cache: 'no-store', signal: ctrl.signal });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  private clearTimers(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.retryTimer = null;
    this.tickTimer = null;
  }
}
