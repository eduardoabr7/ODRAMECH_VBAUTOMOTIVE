import { BodyPortalDirective } from '../directives/body-portal.directive';
import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';

export interface LightboxImage {
  src: string;
  name: string;
}

/**
 * Imagem inteira por cima da tela. Esc fecha; setas (ou deslizar o dedo) passam para a próxima;
 * clique na imagem alterna entre "caber na tela" e tamanho real (com rolagem).
 */
@Component({
  selector: 'app-image-lightbox',
  standalone: true,
  imports: [BodyPortalDirective],
  template: `
    <div class="lb" appBodyPortal role="dialog" aria-modal="true" [attr.aria-label]="current.name" (click)="close()">
      <header class="lb-bar" (click)="$event.stopPropagation()">
        <span class="lb-name" [title]="current.name">{{ current.name }}</span>
        @if (images.length > 1) { <span class="lb-count">{{ index + 1 }} / {{ images.length }}</span> }
        <a class="lb-btn" [href]="current.src" target="_blank" rel="noopener" [attr.download]="current.name" title="Abrir original"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
        <button type="button" class="lb-btn" (click)="close()" title="Fechar (Esc)" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
      </header>

      <div class="lb-stage" [class.zoomed]="zoomed"
        (pointerdown)="onPointerDown($event)" (pointerup)="onPointerUp($event)">
        <img [src]="current.src" [alt]="current.name" draggable="false" (click)="toggleZoom($event)">
      </div>

      @if (images.length > 1) {
        <button type="button" class="lb-nav prev" (click)="prev($event)" aria-label="Anterior"><i class="fa-solid fa-chevron-left"></i></button>
        <button type="button" class="lb-nav next" (click)="next($event)" aria-label="Próxima"><i class="fa-solid fa-chevron-right"></i></button>
      }
    </div>
  `,
  styles: [`
    .lb { position: fixed; inset: 0; z-index: 1090; background: rgba(10,10,10,.92); display: flex; flex-direction: column; animation: lb-in .16s ease-out; }
    .lb-bar { display: flex; align-items: center; gap: 10px; padding: calc(10px + env(safe-area-inset-top)) 14px 10px; color: #fff; font-size: 13px; }
    .lb-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .85; }
    .lb-count { opacity: .6; font-variant-numeric: tabular-nums; }
    .lb-btn { width: 38px; height: 38px; border-radius: 10px; border: 0; display: grid; place-items: center; background: rgba(255,255,255,.12); color: #fff; font-size: 15px; cursor: pointer; text-decoration: none;
      &:hover { background: rgba(255,255,255,.22); color: #fff; } }
    .lb-stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 0 12px 16px; overflow: hidden; touch-action: pan-y pinch-zoom;
      img { max-width: 100%; max-height: 100%; object-fit: contain; cursor: zoom-in; user-select: none; border-radius: 4px; }
      &.zoomed { overflow: auto; align-items: flex-start; justify-content: flex-start; touch-action: auto;
        img { max-width: none; max-height: none; cursor: zoom-out; margin: auto; } } }
    .lb-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 46px; height: 46px; border-radius: 50%; border: 0; background: rgba(255,255,255,.14); color: #fff; font-size: 16px; cursor: pointer;
      &:hover { background: rgba(255,255,255,.26); } &.prev { left: 12px; } &.next { right: 12px; } }
    @media (hover: none) { .lb-nav { display: none; } }
    @keyframes lb-in { from { opacity: 0; } }
  `],
})
export class ImageLightboxComponent implements OnInit, OnDestroy {
  @Input({ required: true }) images: LightboxImage[] = [];
  @Input() index = 0;
  @Output() closed = new EventEmitter<void>();

  zoomed = false;
  private swipeStartX: number | null = null;
  /** o click que vem depois de deslizar não deve dar zoom */
  private swiped = false;
  private previousOverflow = '';

  get current(): LightboxImage { return this.images[this.index] ?? { src: '', name: '' }; }

  ngOnInit(): void {
    // trava a rolagem da página por trás
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void { document.body.style.overflow = this.previousOverflow; }

  close(): void { this.closed.emit(); }

  next(e?: Event): void { e?.stopPropagation(); this.go(1); }
  prev(e?: Event): void { e?.stopPropagation(); this.go(-1); }

  private go(step: number): void {
    if (this.images.length < 2) return;
    this.index = (this.index + step + this.images.length) % this.images.length;
    this.zoomed = false;
  }

  toggleZoom(e: Event): void {
    e.stopPropagation();
    if (this.swiped) { this.swiped = false; return; }
    this.zoomed = !this.zoomed;
  }

  onPointerDown(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' && !this.zoomed) this.swipeStartX = e.clientX;
  }

  onPointerUp(e: PointerEvent): void {
    if (this.swipeStartX === null) return;
    const dx = e.clientX - this.swipeStartX;
    this.swipeStartX = null;
    this.swiped = Math.abs(dx) > 60;
    if (this.swiped) dx < 0 ? this.go(1) : this.go(-1);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') this.close();
    else if (e.key === 'ArrowRight') this.go(1);
    else if (e.key === 'ArrowLeft') this.go(-1);
    else return;
    e.preventDefault();
  }
}
