import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * COMMAND (frontend) — uma ação já executada que sabe se desfazer.
 * O backend devolve um token de undo; quem executou a ação registra aqui
 * um comando que chama o endpoint de desfazer e atualiza a tela.
 */
export interface UndoableCommand {
  label: string;
  undo(): Observable<unknown>;
  /** chamado depois que o undo deu certo (ex.: recarregar a OS) */
  onUndone?(): void;
}

const VISIBLE_MS = 8000;

@Injectable({ providedIn: 'root' })
export class UndoService {
  readonly current = signal<UndoableCommand | null>(null);
  readonly busy = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  offer(command: UndoableCommand): void {
    this.clearTimer();
    this.current.set(command);
    this.timer = setTimeout(() => this.dismiss(), VISIBLE_MS);
  }

  run(): void {
    const command = this.current();
    if (!command || this.busy()) return;
    this.clearTimer();
    this.busy.set(true);
    command.undo().subscribe({
      next: () => {
        this.busy.set(false);
        this.current.set(null);
        command.onUndone?.();
      },
      error: () => {
        this.busy.set(false);
        this.current.set(null);
      },
    });
  }

  dismiss(): void {
    this.clearTimer();
    this.current.set(null);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
