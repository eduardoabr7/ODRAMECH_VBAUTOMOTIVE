import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

/**
 * COMMAND — cada operação de escrita relevante é um objeto com `execute()` e,
 * quando faz sentido, `undo()`.
 *
 * Ganhos: a operação fica testável isoladamente, pode ser enfileirada/registrada
 * (auditoria) e o usuário pode DESFAZER a última ação (ex.: mudança de status da OS).
 */
export interface Command<R = unknown> {
  /** rótulo legível para auditoria/log */
  readonly label: string;
  execute(): Promise<R>;
  /** comandos não reversíveis simplesmente não implementam */
  undo?(): Promise<void>;
}

interface UndoEntry {
  command: Command;
  ownerId: number;
  expiresAt: number;
}

/** Janela em que o "desfazer" fica disponível. */
const UNDO_WINDOW_MS = 30_000;

@Injectable()
export class CommandBus {
  private readonly logger = new Logger(CommandBus.name);
  private readonly undoStack = new Map<string, UndoEntry>();

  /**
   * Executa o comando. Se ele for reversível, devolve um token que permite desfazer
   * por alguns segundos (apenas pelo mesmo usuário).
   */
  async dispatch<R>(command: Command<R>, ownerId: number): Promise<{ result: R; undoToken: string | null }> {
    const started = Date.now();
    const result = await command.execute();
    this.logger.debug(`${command.label} (${Date.now() - started}ms)`);

    if (!command.undo) return { result, undoToken: null };

    this.purgeExpired();
    const token = randomUUID();
    this.undoStack.set(token, { command, ownerId, expiresAt: Date.now() + UNDO_WINDOW_MS });
    return { result, undoToken: token };
  }

  async undo(token: string, ownerId: number): Promise<string> {
    this.purgeExpired();
    const entry = this.undoStack.get(token);
    if (!entry || entry.ownerId !== ownerId) {
      throw new NotFoundException('Não há mais o que desfazer (o prazo pode ter expirado).');
    }
    this.undoStack.delete(token);
    await entry.command.undo!();
    this.logger.debug(`Desfeito: ${entry.command.label}`);
    return entry.command.label;
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [token, entry] of this.undoStack) if (entry.expiresAt < now) this.undoStack.delete(token);
  }
}
