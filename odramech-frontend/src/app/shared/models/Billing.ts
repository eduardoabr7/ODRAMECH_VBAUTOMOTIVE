import { PersonRef, VehicleRef } from './WorkOrder';
import { StatusOS } from '@shared/enums/status-os.enum';

export type ItemKind = 'PECA' | 'SERVICO';
export type PaymentMethod = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'BOLETO';
export type QuoteStatus = 'RASCUNHO' | 'ENVIADO' | 'APROVADO' | 'RECUSADO' | 'EXPIRADO';

export const ITEM_KIND_LABEL: Record<ItemKind, string> = { PECA: 'Peça', SERVICO: 'Serviço' };

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  DINHEIRO: 'Dinheiro', PIX: 'Pix', DEBITO: 'Débito', CREDITO: 'Crédito', BOLETO: 'Boleto',
};

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  RASCUNHO: 'Rascunho', ENVIADO: 'Enviado', APROVADO: 'Aprovado', RECUSADO: 'Recusado', EXPIRADO: 'Expirado',
};

export const QUOTE_STATUS_ORDER: QuoteStatus[] = ['RASCUNHO', 'ENVIADO', 'APROVADO', 'RECUSADO', 'EXPIRADO'];

export interface ServiceItemInput {
  kind: ItemKind;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  /** peça do estoque (módulo Estoque) */
  partId?: number | null;
}

export interface ServiceItem extends ServiceItemInput {
  id: number;
  discount: number;
  total: number;
  createdAt: string;
  /** quanto esta linha já tirou do estoque */
  stockQuantity?: number;
  part?: { id: number; name: string; code: string | null; unit: string } | null;
}

/** peça sugerida ao lançar um item (vem do módulo Estoque) */
export interface PartOption {
  id: number;
  name: string;
  code: string | null;
  brand: string | null;
  unit: string;
  quantity: number;
  salePrice: number;
}

export interface Payment {
  id: number;
  method: PaymentMethod;
  amount: number;
  paidAt: string;
  user: { id: number; name: string };
}

export interface Review {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface MoneySummary {
  total: number;
  paid: number;
  balance: number;
}

export interface Quote {
  id: number;
  numberQuote: number;
  status: QuoteStatus;
  createdAt: string;
  validUntil: string | null;
  notes: string | null;
  client: PersonRef;
  vehicle: VehicleRef;
  userCreation: { id: number; name: string };
  workOrder: { id: number; numberOs: number; status: StatusOS } | null;
  items: ServiceItem[];
  total: number;
  /** sobe a cada alteração de conteúdo */
  version: number;
  /** link do cliente (ver/aprovar/recusar), existe depois do primeiro envio */
  publicToken: string | null;
  emailSentAt: string | null;
  /** versão que foi enviada; igual a `version` = nada novo para enviar */
  emailSentVersion: number | null;
  /** envio automático agendado */
  emailPendingAt: string | null;
  clientRespondedAt: string | null;
  emails: QuoteEmailLog[];
}

export interface QuoteEmailLog {
  id: number;
  version: number;
  kind: 'ENVIO' | 'ATUALIZACAO';
  trigger: 'AUTOMATICO' | 'MANUAL';
  status: 'ENVIADO' | 'SIMULADO' | 'FALHOU';
  toEmail: string;
  error: string | null;
  createdAt: string;
}

export interface QuoteCreate {
  clientId: number;
  vehicleId: number;
  validUntil?: string;
  notes?: string;
  items: ServiceItemInput[];
}

export interface FinanceStats {
  revenueToday: number;
  revenueMonth: number;
  receivable: number;
  ratingAvg: number | null;
  ratingCount: number;
}

/** soma de linhas no cliente (prévia antes de salvar) */
export function lineTotal(i: { quantity: number; unitPrice: number; discount?: number }): number {
  return Math.round(((Number(i.quantity) || 0) * (Number(i.unitPrice) || 0) - (Number(i.discount) || 0)) * 100) / 100;
}
