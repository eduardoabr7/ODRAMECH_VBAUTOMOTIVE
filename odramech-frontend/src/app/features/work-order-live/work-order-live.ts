import { DestroyRef, inject, Injectable, NgZone, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NestAPI } from '@shared/services/nest-api.service';
import { AuthService } from '@shared/services/auth.service';

export interface WorkOrderViewer {
  userId: number;
  name: string;
  kind: 'STAFF' | 'CLIENT';
}

type LiveMessage =
  | { type: 'viewers'; viewers: WorkOrderViewer[] }
  | { type: 'changed'; by: number }
  | { type: 'ping' };

/**
 * "Ao vivo" da tela da OS — uma instância por tela (providers do componente).
 *
 * Abre UMA conexão SSE com o servidor (`/workorder/:id/live`) e só recebe mensagem quando algo
 * acontece: alguém entrou/saiu (lista de quem está vendo, só para a equipe) ou alguém alterou a OS
 * (`stale` liga e a tela mostra "Recarregar"). Nada de consulta periódica.
 * Alteração feita por mim mesmo não acusa. O EventSource reconecta sozinho se a conexão cair.
 */
@Injectable()
export class WorkOrderLive {
  private readonly api = inject(NestAPI);
  private readonly zone = inject(NgZone);

  /** outras pessoas com a OS aberta agora */
  readonly viewers = signal<WorkOrderViewer[]>([]);
  /** alguém mudou a OS depois do que está na tela */
  readonly stale = signal(false);

  private source: EventSource | null = null;
  private workOrderId: number | null = null;
  private myUserId: number | null = null;

  constructor() {
    inject(AuthService).user$.pipe(takeUntilDestroyed()).subscribe(ctx => (this.myUserId = ctx?.user?.id ?? null));
    inject(DestroyRef).onDestroy(() => this.close());
  }

  /** a tela (re)carregou a OS: o conteúdo na tela está em dia */
  loaded(workOrderId: number): void {
    this.stale.set(false);
    if (this.workOrderId === workOrderId && this.source) return;
    this.close();
    this.workOrderId = workOrderId;
    if (typeof EventSource === 'undefined') return; // renderização no servidor

    const source = new EventSource(this.api.url(`workorder/${workOrderId}/live`), { withCredentials: true });
    source.onmessage = e => {
      let msg: LiveMessage;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === 'viewers') {
        this.viewers.set(msg.viewers.filter(v => v.userId !== this.myUserId));
      } else if (msg.type === 'changed' && msg.by !== this.myUserId) {
        this.stale.set(true);
      }
    };
    this.source = source;
  }

  private close(): void {
    this.source?.close();
    this.source = null;
    this.workOrderId = null;
    this.viewers.set([]);
  }
}
