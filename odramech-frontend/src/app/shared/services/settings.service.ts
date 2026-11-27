import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Quote } from '@shared/models/Billing';
import { Branding, BrandingUpdate, PublicBranding, QuoteDocument, QuoteDocumentPreview, QuoteDocumentUpdate } from '@shared/models/Settings';
import { NestAPI } from './nest-api.service';

/** Configurações do estabelecimento (documento de orçamento) e da empresa (tema). */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  constructor(private readonly _api: NestAPI, private readonly _http: HttpClient) {}

  getQuoteDocument(): Observable<QuoteDocument> { return this._api.get('settings/quote-document'); }
  saveQuoteDocument(data: QuoteDocumentUpdate): Observable<QuoteDocument> { return this._api.put('settings/quote-document', data); }

  /** HTML da pré-visualização (orçamento de exemplo + rascunho) */
  previewQuoteDocument(draft: QuoteDocumentPreview): Observable<string> {
    return this._http.post(this._api.url('settings/quote-document/preview'), draft, { withCredentials: true, responseType: 'text' });
  }

  /** HTML do documento de um orçamento (para imprimir) */
  quoteDocumentHtml(quoteId: number): Observable<string> {
    return this._http.get(this._api.url(`quote/${quoteId}/document`), { withCredentials: true, responseType: 'text' });
  }

  /** avisa o backend que o orçamento foi impresso (pode virar "Enviado", conforme configuração) */
  markQuotePrinted(quoteId: number): Observable<{ changed: boolean; quote: Quote }> {
    return this._api.post(`quote/${quoteId}/printed`, {});
  }

  getBranding(): Observable<Branding> { return this._api.get('settings/branding'); }
  saveBranding(data: BrandingUpdate): Observable<Branding> { return this._api.put('settings/branding', data); }

  publicBranding(key: string): Observable<PublicBranding> { return this._api.get(`branding/public/${encodeURIComponent(key)}`); }
}
