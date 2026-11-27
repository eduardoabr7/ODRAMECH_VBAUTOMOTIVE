import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NestAPI } from './nest-api.service';
import {
  Payment, PaymentMethod, Quote, QuoteCreate, QuoteStatus, Review, ServiceItem, ServiceItemInput,
} from '@shared/models/Billing';
import { ArchiveAppointment } from '@shared/models/WorkOrder';

@Injectable({ providedIn: 'root' })
export class BillingService {
  constructor(private readonly _api: NestAPI) {}

  // ── Orçamentos ──────────────────────────────────────────
  listQuotes(status?: QuoteStatus | null, search?: string): Observable<Quote[]> {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (search?.trim()) p.set('search', search.trim());
    const qs = p.toString();
    return this._api.get(`quote${qs ? `?${qs}` : ''}`);
  }

  getQuote(id: number): Observable<Quote> { return this._api.get(`quote/${id}`); }
  createQuote(data: QuoteCreate): Observable<Quote> { return this._api.post('quote', data); }

  updateQuote(id: number, data: { status?: QuoteStatus; validUntil?: string | null; notes?: string | null }): Observable<Quote> {
    return this._api.put(`quote/${id}`, data);
  }

  addQuoteItem(id: number, item: ServiceItemInput): Observable<Quote> { return this._api.post(`quote/${id}/items`, item); }

  convertQuote(id: number): Observable<{ workOrderId: number; numberOs: number }> {
    return this._api.post(`quote/${id}/convert`, {});
  }

  // ── Itens (orçamento ou OS) ─────────────────────────────
  addWorkOrderItem(workOrderId: number, item: ServiceItemInput): Observable<ServiceItem> {
    return this._api.post(`workorder/${workOrderId}/items`, item);
  }

  updateItem(itemId: number, item: Partial<ServiceItemInput>): Observable<ServiceItem> {
    return this._api.put(`items/${itemId}`, item);
  }

  deleteItem(itemId: number): Observable<{ deleted: boolean }> { return this._api.delete(`items/${itemId}`); }

  // ── Pagamentos ──────────────────────────────────────────
  addPayment(workOrderId: number, method: PaymentMethod, amount: number): Observable<Payment> {
    return this._api.post(`workorder/${workOrderId}/payments`, { method, amount });
  }

  deletePayment(paymentId: number): Observable<{ deleted: boolean }> { return this._api.delete(`payments/${paymentId}`); }

  // ── Avaliação ───────────────────────────────────────────
  review(workOrderId: number, rating: number, comment?: string): Observable<Review> {
    return this._api.post(`workorder/${workOrderId}/review`, { rating, comment: comment || undefined });
  }

  // ── Anexos ──────────────────────────────────────────────
  uploadFiles(appointmentId: number, files: File[]): Observable<ArchiveAppointment[]> {
    const form = new FormData();
    files.forEach(f => form.append('files', f, f.name));
    return this._api.post(`appointments/${appointmentId}/files`, form);
  }

  deleteFile(archiveId: number): Observable<{ deleted: boolean }> { return this._api.delete(`files/${archiveId}`); }

  fileUrl(archiveId: number): string { return this._api.url(`files/${archiveId}`); }

  // ── Anotações ───────────────────────────────────────────
  getNote(): Observable<{ content: string; updatedAt: string | null }> { return this._api.get('notes'); }
  saveNote(content: string): Observable<{ content: string; updatedAt: string }> { return this._api.put('notes', { content }); }
}
