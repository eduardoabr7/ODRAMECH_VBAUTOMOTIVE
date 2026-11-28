import { HttpException, HttpStatus, Injectable, MessageEvent, OnModuleInit } from '@nestjs/common';
import { Observable, Subscriber } from 'rxjs';
import { DomainEventBus } from 'src/core/events/domain-event-bus';
import { WorkOrderContentChanged, WorkOrderResponsibleChanged, WorkOrderStatusChanged } from '../domain/work-order.events';

export interface LiveViewer {
  userId: number;
  name: string;
  /** equipe ou cliente dono da OS */
  kind: 'STAFF' | 'CLIENT';
}

interface Connection {
  id: number;
  viewer: LiveViewer;
  staff: boolean;
  out: Subscriber<MessageEvent>;
}

/** mantém a conexão viva atrás de proxies (Nginx/Cloudflare derrubam conexão parada) — não toca no banco */
export const KEEPALIVE_MS = 25_000;
/** mesma pessoa com muitas abas/telas abertas: limite contra esgotar conexões do servidor */
export const MAX_CONNECTIONS_PER_USER = 20;

/**
 * OS "ao vivo" por push (SSE) — sem consulta periódica.
 *
 *  - Cada tela de OS aberta mantém UMA conexão. Abrir/fechar a conexão = entrar/sair da lista de
 *    quem está vendo (a lista só vai para a equipe; cliente nunca vê nomes da equipe).
 *  - Quando alguém altera a OS, o código que altera publica um evento de domínio (OBSERVER) e o hub
 *    avisa só quem está com AQUELA OS aberta. Sem alteração, nada acontece: zero consultas ao banco.
 *
 * Em memória: o backend roda em uma instância só. Com várias instâncias, os eventos precisam passar
 * por um pub/sub compartilhado (ex.: Redis) — esta classe é o único lugar que muda.
 */
@Injectable()
export class WorkOrderLiveHub implements OnModuleInit {
  private readonly rooms = new Map<number, Map<number, Connection>>();
  private seq = 0;

  constructor(private readonly events: DomainEventBus) {}

  onModuleInit(): void {
    this.events.subscribe(WorkOrderContentChanged, { handle: e => this.changed(e.workOrderId, e.userId, e.staffOnly) });
    this.events.subscribe(WorkOrderStatusChanged, { handle: e => this.changed(e.workOrderId, e.userId, false) });
    this.events.subscribe(WorkOrderResponsibleChanged, { handle: e => this.changed(e.workOrderId, e.userId, false) });
  }

  /** stream SSE de uma tela de OS (o acesso à OS já foi conferido por quem chama) */
  connect(workOrderId: number, viewer: LiveViewer, staff: boolean): Observable<MessageEvent> {
    if (this.connectionsOf(viewer.userId) >= MAX_CONNECTIONS_PER_USER) {
      throw new HttpException('Muitas telas abertas ao mesmo tempo. Feche algumas e tente de novo.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return new Observable<MessageEvent>(out => {
      const id = ++this.seq;
      let room = this.rooms.get(workOrderId);
      if (!room) this.rooms.set(workOrderId, (room = new Map()));
      room.set(id, { id, viewer, staff, out });
      this.broadcastViewers(workOrderId);
      const keepalive = setInterval(() => out.next({ data: { type: 'ping' } }), KEEPALIVE_MS);

      // fechou a aba / saiu da tela / caiu a conexão
      return () => {
        clearInterval(keepalive);
        const r = this.rooms.get(workOrderId);
        r?.delete(id);
        if (r && !r.size) this.rooms.delete(workOrderId);
        this.broadcastViewers(workOrderId);
      };
    });
  }

  /** quem está com a OS aberta agora (uma linha por pessoa) */
  viewers(workOrderId: number): LiveViewer[] {
    const people = new Map<number, LiveViewer>();
    for (const c of this.rooms.get(workOrderId)?.values() ?? []) people.set(c.viewer.userId, c.viewer);
    return [...people.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  private changed(workOrderId: number, by: number, staffOnly: boolean): void {
    for (const c of this.rooms.get(workOrderId)?.values() ?? []) {
      if (staffOnly && !c.staff) continue;
      c.out.next({ data: { type: 'changed', by } });
    }
  }

  private broadcastViewers(workOrderId: number): void {
    const viewers = this.viewers(workOrderId);
    for (const c of this.rooms.get(workOrderId)?.values() ?? []) {
      if (c.staff) c.out.next({ data: { type: 'viewers', viewers } });
    }
  }

  private connectionsOf(userId: number): number {
    let n = 0;
    for (const room of this.rooms.values()) for (const c of room.values()) if (c.viewer.userId === userId) n++;
    return n;
  }
}
