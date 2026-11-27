import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { NestAPI } from '@shared/services/nest-api.service';
import { printHtml } from '../quote-document/print-html';

interface PublicQuote {
  numberQuote: number;
  status: 'RASCUNHO' | 'ENVIADO' | 'APROVADO' | 'RECUSADO' | 'EXPIRADO';
  createdAt: string;
  validUntil: string | null;
  notes: string | null;
  clientFirstName: string;
  vehicle: { plate: string; name: string; make: string };
  items: { kind: 'PECA' | 'SERVICO'; description: string; quantity: number; unitPrice: number; discount: number; total: number }[];
  total: number;
  convertedToWorkOrder: boolean;
  respondedAt: string | null;
  expired: boolean;
  canRespond: boolean;
  establishment: { name: string; phone: string; email: string | null };
  branding: { displayName: string | null; logoUrl: string | null; accentColor: string | null };
}

/**
 * Página que o cliente abre pelo e-mail (sem login): vê o orçamento e aprova ou recusa.
 * Os botões do e-mail só trazem até aqui (?acao=aprovar) — a resposta exige um clique na página,
 * assim leitores de e-mail que "visitam" links não aprovam nada sozinhos.
 */
@Component({
  selector: 'app-public-quote',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './public-quote.component.html',
  styleUrl: './public-quote.component.scss',
})
export class PublicQuoteComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly api = inject(NestAPI);
  private readonly title = inject(Title);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly quote = signal<PublicQuote | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly busy = signal<'aprovar' | 'recusar' | null>(null);
  readonly error = signal<string | null>(null);
  /** ação pedida pelo botão do e-mail — destacada até a pessoa confirmar */
  readonly intent = signal<'aprovar' | 'recusar' | null>(null);
  readonly justAnswered = signal(false);

  private token = '';

  readonly accent = computed(() => {
    const c = this.quote()?.branding.accentColor;
    return c && /^#[0-9a-f]{6}$/i.test(c) ? c : '#e4531c';
  });
  readonly brandName = computed(() => this.quote()?.branding.displayName || this.quote()?.establishment.name || '');
  readonly parts = computed(() => this.quote()?.items.filter(i => i.kind === 'PECA').reduce((a, i) => a + i.total, 0) ?? 0);
  readonly labor = computed(() => this.quote()?.items.filter(i => i.kind === 'SERVICO').reduce((a, i) => a + i.total, 0) ?? 0);

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    const acao = this.route.snapshot.queryParamMap.get('acao');
    if (acao === 'aprovar' || acao === 'recusar') this.intent.set(acao);
    if (!this.isBrowser) return;
    this.http.get<PublicQuote>(this.api.url(`public/quotes/${encodeURIComponent(this.token)}`)).subscribe({
      next: q => this.set(q),
      error: () => { this.loading.set(false); this.notFound.set(true); },
    });
  }

  private set(q: PublicQuote): void {
    this.quote.set(q);
    this.loading.set(false);
    this.title.setTitle(`Orçamento nº ${q.numberQuote} · ${q.branding.displayName || q.establishment.name}`);
  }

  respond(action: 'aprovar' | 'recusar'): void {
    if (this.busy()) return;
    this.busy.set(action);
    this.error.set(null);
    const path = action === 'aprovar' ? 'approve' : 'decline';
    this.http.post<PublicQuote>(this.api.url(`public/quotes/${encodeURIComponent(this.token)}/${path}`), {}).subscribe({
      next: q => { this.busy.set(null); this.intent.set(null); this.justAnswered.set(true); this.set(q); },
      error: err => { this.busy.set(null); this.error.set(err?.error?.message ?? 'Não foi possível registrar sua resposta. Tente de novo.'); },
    });
  }

  printDocument(): void {
    this.http.get(this.api.url(`public/quotes/${encodeURIComponent(this.token)}/document`), { responseType: 'text' })
      .subscribe({ next: html => void printHtml(html), error: () => this.error.set('Não foi possível abrir o documento.') });
  }

  money(v: number): string {
    return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
