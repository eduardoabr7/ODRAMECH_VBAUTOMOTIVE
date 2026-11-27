import {
  AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output,
  PLATFORM_ID, SimpleChanges, ViewChild, inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

type JQ = any;
let loader: Promise<JQ> | null = null;

// jQuery + Summernote lite carregados só no navegador e só quando o editor abre (SSR)
function loadSummernote(): Promise<JQ> {
  if (!loader) {
    loader = (async () => {
      // CSS do editor é um bundle separado (não pesa no carregamento inicial do sistema)
      if (!document.querySelector('link[data-summernote]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'summernote.css';
        link.dataset['summernote'] = '1';
        document.head.appendChild(link);
      }
      const jq: any = await import('jquery');
      const $ = jq.default ?? jq;
      (window as any).jQuery = (window as any).$ = $;
      await import('summernote/dist/summernote-lite.js' as any);
      await import('summernote/dist/lang/summernote-pt-BR.js' as any);
      return $;
    })();
    loader.catch(() => { loader = null; });
  }
  return loader;
}

// editor WYSIWYG que também aceita HTML direto (botão de código)
@Component({
  selector: 'app-summernote-editor',
  standalone: true,
  template: `
    <div class="sn-wrap" [class.loading]="!ready">
      <textarea #host></textarea>
      @if (!ready) { <div class="sn-loading"><span class="spinner-x"></span> Carregando editor…</div> }
    </div>`,
  styles: [`
    :host { display: block; }
    .sn-wrap { position: relative; min-height: 120px; }
    .sn-wrap.loading textarea { visibility: hidden; }
    .sn-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; color: var(--muted); border: 1px dashed var(--line-strong); border-radius: var(--r-sm); }
  `],
})
export class SummernoteEditorComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLTextAreaElement>;
  @Input() value: string | null = '';
  @Input() height = 160;
  @Input() placeholder = '';
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<string>();

  ready = false;
  private $: JQ | null = null;
  private lastEmitted: string | null = null;
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser) return;
    try {
      this.$ = await loadSummernote();
    } catch {
      return; // sem editor: a tela continua funcionando (o HTML salvo é mantido)
    }
    const $el = this.$(this.host.nativeElement);
    $el.summernote({
      lang: 'pt-BR',
      height: this.height,
      placeholder: this.placeholder,
      dialogsInBody: true,
      disableDragAndDrop: false,
      toolbar: [
        ['style', ['style']],
        ['font', ['bold', 'italic', 'underline', 'strikethrough', 'clear']],
        ['fontsize', ['fontsize']],
        ['color', ['color']],
        ['para', ['ul', 'ol', 'paragraph']],
        ['table', ['table']],
        ['insert', ['link', 'picture', 'hr']],
        ['view', ['codeview']],
      ],
      callbacks: {
        onChange: (contents: string) => this.zone.run(() => this.emit(contents)),
        // no modo código o onChange não dispara a cada tecla em todas as versões
        onBlurCodeview: (code: string) => this.zone.run(() => this.emit(code)),
      },
    });
    $el.summernote('code', this.value ?? '');
    if (this.disabled) $el.summernote('disable');
    this.ready = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.ready || !this.$) return;
    const $el = this.$(this.host.nativeElement);
    if (changes['value'] && this.value !== this.lastEmitted) {
      $el.summernote('code', this.value ?? '');
    }
    if (changes['disabled']) $el.summernote(this.disabled ? 'disable' : 'enable');
  }

  /** insere texto (ex.: uma variável {{cliente.nome}}) onde está o cursor */
  insertText(text: string): void {
    if (!this.ready || !this.$) return;
    const $el = this.$(this.host.nativeElement);
    if ($el.summernote('codeview.isActivated')) {
      const area = this.host.nativeElement.parentElement?.querySelector('.note-codable') as HTMLTextAreaElement | null;
      if (area) {
        const { selectionStart: s, selectionEnd: e, value } = area;
        area.value = value.slice(0, s) + text + value.slice(e);
        area.selectionStart = area.selectionEnd = s + text.length;
        this.emit(area.value);
      }
      return;
    }
    $el.summernote('restoreRange');
    $el.summernote('editor.insertText', text);
  }

  /** guarda a posição do cursor antes de clicar fora (ex.: na lista de variáveis) */
  saveRange(): void {
    if (this.ready && this.$) this.$(this.host.nativeElement).summernote('saveRange');
  }

  private emit(html: string): void {
    const clean = html === '<p><br></p>' ? '' : html;
    // a carga inicial do conteúdo também dispara onChange: não conta como edição
    if (!this.ready) return;
    this.lastEmitted = clean;
    this.valueChange.emit(clean);
  }

  ngOnDestroy(): void {
    if (this.ready && this.$) {
      try { this.$(this.host.nativeElement).summernote('destroy'); } catch { /* já destruído */ }
    }
  }
}
