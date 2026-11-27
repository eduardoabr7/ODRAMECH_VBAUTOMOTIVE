import { Directive, ElementRef, Inject, Input, OnChanges, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Anima um número de 0 (ou do valor anterior) até o valor alvo. */
@Directive({
  selector: '[countUp]',
  standalone: true,
})
export class CountUpDirective implements OnChanges, OnDestroy {
  @Input('countUp') target: number | null | undefined = 0;
  @Input() countDuration = 900;

  private frame: number | null = null;
  private current = 0;

  constructor(private readonly el: ElementRef<HTMLElement>, @Inject(PLATFORM_ID) private readonly platformId: object) {}

  ngOnChanges(): void {
    const to = Number(this.target ?? 0);

    const reduce = isPlatformBrowser(this.platformId)
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (!isPlatformBrowser(this.platformId) || reduce) {
      this.render(to);
      return;
    }

    const from = this.current;
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);

    if (this.frame) cancelAnimationFrame(this.frame);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / this.countDuration);
      this.render(from + (to - from) * ease(t));
      if (t < 1) this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private render(value: number) {
    this.current = value;
    this.el.nativeElement.textContent = Math.round(value).toLocaleString('pt-BR');
  }

  ngOnDestroy(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
  }
}
