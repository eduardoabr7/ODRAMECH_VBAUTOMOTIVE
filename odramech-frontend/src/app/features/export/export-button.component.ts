import { Component, ElementRef, HostListener, Input, inject } from '@angular/core';
import { BodyPortalDirective } from '@shared/directives/body-portal.directive';
import { ToastrService } from 'ngx-toastr';
import { ExportFilters, ExportKind, ExportService } from './export.service';

export interface ExportOption {
  kind: ExportKind;
  label: string;
  /** texto menor no menu */
  hint?: string;
  /** filtros da tela no momento do clique */
  filters?: () => ExportFilters;
}

/**
 * Botão "Exportar" das listas. Uma opção → baixa direto; várias → menu.
 * Os filtros são lidos na hora do clique, então a planilha sai igual ao que está na tela.
 */
@Component({
  selector: 'app-export-button',
  standalone: true,
  imports: [BodyPortalDirective],
  template: `
    <div class="xb">
      <button type="button" class="btn-x btn-outline" [disabled]="busy" (click)="onMain($event)"
        [attr.aria-expanded]="options.length > 1 ? open : null" title="Exportar para Excel (.xlsx)">
        @if (busy) { <span class="spinner-x"></span> } @else { <i class="fa-solid fa-file-excel"></i> }
        <span class="lbl">{{ label }}</span>
        @if (options.length > 1) { <i class="fa-solid fa-chevron-down caret"></i> }
      </button>
      @if (open) {
        <div class="xb-menu" appBodyPortal role="menu" [style.top.px]="menuTop" [style.right.px]="menuRight" (click)="$event.stopPropagation()">
          @for (o of options; track o.kind) {
            <button type="button" role="menuitem" (click)="run(o)">
              <i class="fa-regular fa-file-excel"></i>
              <span><b>{{ o.label }}</b>@if (o.hint) { <small>{{ o.hint }}</small> }</span>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .xb { position: relative; display: inline-flex; }
    .caret { font-size: 10px; margin-left: 2px; opacity: .7; }
    .fa-file-excel { color: #1d6f42; }
    @media (max-width: 520px) { .lbl { display: none; } }
    .xb-menu { position: fixed; z-index: 1070; min-width: 250px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); box-shadow: 0 12px 32px rgba(0,0,0,.12); padding: 6px;
      button { display: flex; gap: 10px; width: 100%; text-align: left; border: 0; background: none; padding: 9px 10px; border-radius: var(--r-sm); cursor: pointer; color: var(--ink);
        &:hover { background: var(--surface-2); } i { margin-top: 2px; }
        b { display: block; font-size: 13px; font-weight: 500; } small { display: block; font-size: 12px; color: var(--muted); } } }
  `],
})
export class ExportButtonComponent {
  private readonly exports = inject(ExportService);
  private readonly toastr = inject(ToastrService);

  @Input({ required: true }) options: ExportOption[] = [];
  @Input() label = 'Exportar';

  open = false;
  busy = false;
  /** o menu vai para o <body> (as listas usam transform na animação, que prenderia o menu atrás dos filtros) */
  menuTop = 0;
  menuRight = 0;

  private readonly host = inject(ElementRef<HTMLElement>);

  onMain(e: Event): void {
    e.stopPropagation();
    if (this.options.length === 1) this.run(this.options[0]);
    else {
      const r = this.host.nativeElement.getBoundingClientRect();
      this.menuTop = r.bottom + 6;
      this.menuRight = Math.max(8, window.innerWidth - r.right);
      this.open = !this.open;
    }
  }

  run(o: ExportOption): void {
    this.open = false;
    this.busy = true;
    this.exports.download(o.kind, o.filters?.() ?? {}).subscribe({
      next: name => { this.busy = false; this.toastr.success(`Planilha ${name} gerada.`); },
      error: err => { this.busy = false; this.toastr.error(err?.error?.message ?? 'Não foi possível exportar.'); },
    });
  }

  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  @HostListener('window:resize')
  @HostListener('window:scroll')
  close(): void { this.open = false; }
}
