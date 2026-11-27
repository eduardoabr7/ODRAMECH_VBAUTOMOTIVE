import { Component, DestroyRef, OnInit, QueryList, ViewChildren, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, filter, switchMap, catchError, of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { SettingsService } from '@shared/services/settings.service';
import { SessionService } from '@shared/services/session.service';
import { QuoteDocument, QuoteTemplate } from '@shared/models/Settings';
import { SummernoteEditorComponent } from './summernote-editor.component';

type Part = 'header' | 'body' | 'footer';

/** Configurações → Documento de orçamento: modelo, validade, impressão e editor HTML (Intermediário+). */
@Component({
  selector: 'app-quote-document-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SummernoteEditorComponent],
  templateUrl: './quote-document-settings.component.html',
  styleUrl: './quote-document-settings.component.scss',
})
export class QuoteDocumentSettingsComponent implements OnInit {
  @ViewChildren(SummernoteEditorComponent) editors!: QueryList<SummernoteEditorComponent>;

  private readonly api = inject(SettingsService);
  private readonly toastr = inject(ToastrService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly isManager = toSignal(inject(SessionService).isManager$, { initialValue: false });

  readonly VARIABLES = computed(() => this.doc()?.templateVariables ?? []);
  readonly TEMPLATES: { code: QuoteTemplate; name: string; desc: string; icon: string }[] = [
    { code: 'ODRAMECH', name: 'Padrão', desc: 'Limpo e direto, com a cor da sua oficina.', icon: 'fa-solid fa-file-lines' },
    { code: 'PREMIUM', name: 'Premium', desc: 'Faixa escura, tipografia elegante e campos de assinatura.', icon: 'fa-solid fa-gem' },
    { code: 'CUSTOM', name: 'Personalizado', desc: 'Cabeçalho, corpo e rodapé do seu jeito, em HTML.', icon: 'fa-solid fa-code' },
  ];

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly doc = signal<QuoteDocument | null>(null);

  // formulário
  readonly template = signal<QuoteTemplate>('ODRAMECH');
  readonly validityDays = signal(15);
  readonly markSent = signal(false);
  readonly autoEmail = signal(false);
  readonly header = signal('');
  readonly body = signal('');
  readonly footer = signal('');
  readonly part = signal<Part>('header');
  readonly dirty = signal(false);

  readonly canCustomize = computed(() => this.doc()?.canCustomize ?? false);
  readonly readOnly = computed(() => !this.isManager());

  /** pré-visualização ao vivo (o servidor monta o mesmo HTML da impressão e do PDF do e-mail) */
  readonly preview = signal<SafeHtml | null>(null);
  private readonly draft = computed(() => this.doc() ? {
    quoteTemplate: this.template(),
    quoteHeaderHtml: this.header() || null,
    quoteBodyHtml: this.body() || null,
    quoteFooterHtml: this.footer() || null,
    quoteValidityDays: Number(this.validityDays()) >= 1 ? Math.round(Number(this.validityDays())) : 15,
  } : null);

  constructor() {
    toObservable(this.draft).pipe(
      filter(d => !!d),
      debounceTime(350),
      switchMap(d => this.api.previewQuoteDocument(d!).pipe(catchError(() => of(null)))),
      takeUntilDestroyed(inject(DestroyRef)),
    ).subscribe(html => {
      // o iframe da prévia é sandbox sem scripts
      if (html !== null) this.preview.set(this.sanitizer.bypassSecurityTrustHtml(html));
    });
  }

  ngOnInit(): void {
    this.api.getQuoteDocument().subscribe({
      next: d => { this.apply(d); this.loading.set(false); },
      error: err => { this.loading.set(false); this.toastr.error(err?.error?.message ?? 'Não foi possível carregar a configuração.'); },
    });
  }

  private apply(d: QuoteDocument): void {
    this.doc.set(d);
    this.template.set(d.settings.quoteTemplate);
    this.validityDays.set(d.settings.quoteValidityDays);
    this.markSent.set(d.settings.markQuoteSentOnPrint);
    this.autoEmail.set(d.settings.autoEmailQuote);
    this.header.set(d.settings.quoteHeaderHtml ?? d.customStarter.header);
    this.body.set(d.settings.quoteBodyHtml ?? d.customStarter.body);
    this.footer.set(d.settings.quoteFooterHtml ?? d.customStarter.footer);
    this.dirty.set(false);
  }

  pick(code: QuoteTemplate): void {
    if (this.readOnly()) return;
    if (code === 'CUSTOM' && !this.canCustomize()) {
      this.toastr.info('O documento personalizado está disponível a partir do plano Intermediário.', 'Recurso do plano');
      return;
    }
    this.template.set(code);
    this.dirty.set(true);
  }

  setPart(value: string, part: Part = this.part()): void {
    ({ header: this.header, body: this.body, footer: this.footer })[part].set(value);
    this.dirty.set(true);
  }

  token(key: string): string { return '{' + '{' + key + '}' + '}'; }

  insertVariable(key: string): void {
    this.editors?.first?.insertText(`{{${key}}}`);
  }

  restoreStarter(): void {
    if (!confirm('Substituir o conteúdo do cabeçalho, corpo e rodapé pelo modelo inicial?')) return;
    const starter = this.doc()?.customStarter;
    if (!starter) return;
    this.header.set(starter.header);
    this.body.set(starter.body);
    this.footer.set(starter.footer);
    this.dirty.set(true);
  }

  touch(): void { this.dirty.set(true); }

  save(): void {
    if (this.readOnly() || this.saving()) return;
    const days = Math.round(Number(this.validityDays()));
    if (!days || days < 1 || days > 365) { this.toastr.warning('A validade deve ser entre 1 e 365 dias.'); return; }

    this.saving.set(true);
    this.api.saveQuoteDocument({
      quoteTemplate: this.template(),
      quoteValidityDays: days,
      markQuoteSentOnPrint: this.markSent(),
      autoEmailQuote: this.autoEmail(),
      // o HTML só vai quando o plano permite (senão o backend recusa)
      ...(this.canCustomize() && {
        quoteHeaderHtml: this.header() || null,
        quoteBodyHtml: this.body() || null,
        quoteFooterHtml: this.footer() || null,
      }),
    }).subscribe({
      next: d => { this.apply(d); this.saving.set(false); this.toastr.success('Documento de orçamento salvo.'); },
      error: err => { this.saving.set(false); this.toastr.error(err?.error?.message ?? 'Não foi possível salvar.'); },
    });
  }
}
