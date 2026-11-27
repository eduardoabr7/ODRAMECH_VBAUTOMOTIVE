import { Injectable, Logger } from '@nestjs/common';

/** Todo evento de domínio tem um nome estável e o momento em que ocorreu. */
export abstract class DomainEvent {
  abstract readonly name: string;
  readonly occurredAt = new Date();
}

export interface DomainEventListener<E extends DomainEvent = DomainEvent> {
  handle(event: E): void | Promise<void>;
}

type EventClass<E extends DomainEvent> = abstract new (...args: any[]) => E;

/**
 * OBSERVER — publica eventos de domínio para quem estiver inscrito.
 *
 * Quem publica (ex.: o comando que muda status da OS) não conhece quem reage
 * (histórico automático, notificações, integrações). Novos efeitos colaterais entram
 * registrando um listener, sem tocar no código que publica (Open/Closed).
 *
 * Falha de um listener é registrada e não derruba a operação principal.
 */
@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);
  private readonly listeners = new Map<EventClass<any>, DomainEventListener<any>[]>();

  subscribe<E extends DomainEvent>(event: EventClass<E>, listener: DomainEventListener<E>): () => void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener);
    this.listeners.set(event, list);
    return () => this.listeners.set(event, (this.listeners.get(event) ?? []).filter(l => l !== listener));
  }

  async publish(event: DomainEvent): Promise<void> {
    for (const [type, listeners] of this.listeners) {
      if (!(event instanceof type)) continue;
      for (const listener of listeners) {
        try {
          await listener.handle(event);
        } catch (err) {
          this.logger.error(`Listener ${listener.constructor.name} falhou em ${event.name}: ${(err as Error).message}`);
        }
      }
    }
  }
}
