import { Directive, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';

/**
 * Navegação por teclado em listas de sugestões (autocomplete).
 * Coloque no elemento que envolve o input e a lista:
 *
 *   <div class="autocomplete-wrap" keyboardList (escape)="show = false"> <input …> <div …><button class="autocomplete-item">…
 *
 * ↓/↑ destacam a opção, Enter escolhe (dispara o click dela), Esc fecha.
 * Ao digitar, o destaque volta para o início.
 */
@Directive({ selector: '[keyboardList]', standalone: true })
export class KeyboardListDirective {
  /** seletor das opções dentro do elemento */
  @Input() keyboardListItems = '.autocomplete-item, .menu-item, [data-option]';
  @Output() escape = new EventEmitter<void>();

  private index = -1;

  constructor(private readonly el: ElementRef<HTMLElement>) {}

  private options(): HTMLElement[] {
    return Array.from(this.el.nativeElement.querySelectorAll<HTMLElement>(this.keyboardListItems))
      .filter(o => o.offsetParent !== null && !(o as HTMLButtonElement).disabled);
  }

  private highlight(opts: HTMLElement[]): void {
    opts.forEach((o, i) => {
      const on = i === this.index;
      o.classList.toggle('kb-active', on);
      o.setAttribute('aria-selected', String(on));
      if (on) o.scrollIntoView({ block: 'nearest' });
    });
  }

  @HostListener('input')
  onInput(): void { this.index = -1; }

  @HostListener('keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    const opts = this.options();
    switch (ev.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (!opts.length) return;
        ev.preventDefault();
        const step = ev.key === 'ArrowDown' ? 1 : -1;
        this.index = this.index < 0 && step < 0 ? opts.length - 1 : (this.index + step + opts.length) % opts.length;
        this.highlight(opts);
        break;
      }
      case 'Enter':
        if (this.index >= 0 && opts[this.index]) {
          ev.preventDefault();
          ev.stopPropagation();
          opts[this.index].click();
          this.index = -1;
        }
        break;
      case 'Escape':
        if (opts.length) { ev.stopPropagation(); this.escape.emit(); }
        this.index = -1;
        break;
      case 'Tab':
        this.index = -1;
        break;
    }
  }
}
