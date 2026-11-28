import { ItemKind, PaymentMethod, QuoteStatus } from '@prisma/client';
import { StockContext } from 'src/inventory/domain/stock';

/**
 * REPOSITORIES (portas) do módulo financeiro — uma por agregado (Interface Segregation):
 * quem só lida com pagamentos não depende de métodos de orçamento, e vice‑versa.
 */

export interface ItemData {
  kind: ItemKind;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  /** peça do estoque vinculada (módulo Estoque) */
  partId?: number | null;
}

export interface QuoteScope {
  establishmentId: number;
  /** cliente logado só vê os próprios orçamentos */
  onlyClientId?: number;
}

export interface QuoteFilter extends QuoteScope {
  status?: QuoteStatus;
  term?: string;
}

export interface CreateQuoteData {
  establishmentId: number;
  clientId: number;
  vehicleId: number;
  userCreationId: number;
  validUntil: Date | null;
  notes: string | null;
  items: ItemData[];
}

export abstract class QuoteRepository {
  abstract list(filter: QuoteFilter, take: number): Promise<any[]>;
  abstract findOne(scope: QuoteScope, id: number): Promise<any | null>;
  /** reserva o próximo número de orçamento do estabelecimento e cria, atomicamente */
  abstract create(data: CreateQuoteData): Promise<{ id: number }>;
  abstract update(id: number, data: { status?: QuoteStatus; validUntil?: Date | null; notes?: string | null }): Promise<void>;
  /** aprova: abre a OS, move os itens e liga orçamento ↔ OS numa única transação */
  abstract convertToWorkOrder(quoteId: number, userId: number, firstNoteHtml: string, stock: StockContext): Promise<{ id: number; numberOs: number }>;
}

export abstract class ServiceItemRepository {
  abstract addToQuote(quoteId: number, item: ItemData): Promise<any>;
  /** item de OS com peça: grava e baixa do estoque na MESMA transação */
  abstract addToWorkOrder(workOrderId: number, item: ItemData, stock: StockContext): Promise<any>;
  abstract findWithOwner(itemId: number): Promise<{ item: any; establishmentId: number | null; lockedQuote: boolean } | null>;
  /** acerta o estoque pela nova quantidade/peça na mesma transação */
  abstract update(itemId: number, data: Partial<ItemData>, stock: StockContext): Promise<any>;
  /** devolve ao estoque o que a linha tinha tirado e apaga, atomicamente */
  abstract delete(itemId: number, stock: StockContext): Promise<void>;
}

export abstract class PaymentRepository {
  abstract create(data: { workOrderId: number; method: PaymentMethod; amount: number; paidAt: Date; userId: number }): Promise<any>;
  abstract findWithEstablishment(paymentId: number): Promise<{ payment: any; establishmentId: number } | null>;
  abstract delete(paymentId: number): Promise<void>;
  abstract sumPaid(establishmentId: number, since: Date, onlyClientId?: number): Promise<number>;
  /** OS finalizadas com itens e pagamentos — base do "a receber" */
  abstract finishedWithMoney(establishmentId: number, onlyClientId?: number): Promise<{ items: any[]; payments: { amount: any }[] }[]>;
}

export abstract class ReviewRepository {
  abstract create(data: { workOrderId: number; clientId: number; rating: number; comment: string | null }): Promise<any>;
  abstract average(establishmentId: number, onlyClientId?: number): Promise<{ avg: number | null; count: number }>;
}

export abstract class NoteRepository {
  abstract get(userId: number, establishmentId: number): Promise<{ content: string; updatedAt: Date } | null>;
  abstract save(userId: number, establishmentId: number, content: string): Promise<{ content: string; updatedAt: Date }>;
}
