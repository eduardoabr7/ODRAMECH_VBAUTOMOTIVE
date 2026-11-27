import { Component, ElementRef, EventEmitter, HostBinding, Input, OnInit, Output } from '@angular/core';

const STORAGE_PREFIX = 'odramech.img-width.';

/**
 * Miniatura que a pessoa redimensiona arrastando o canto (mouse, dedo ou caneta: Pointer Events)
 * ou com as setas do teclado no puxador. Clique na imagem = abrir inteira (evento `open`).
 * O tamanho escolhido fica salvo neste aparelho, por imagem (`storageKey`).
 */
@Component({
  selector: 'app-resizable-image',
  standalone: true,
  template: `
    <img [src]="src" [alt]="alt" loading="lazy" draggable="false" (click)="onImageClick()" (load)="loaded = true" [class.ready]="loaded">
    <span class="ri-handle" role="slider" tabindex="0"
      [attr.aria-label]="'Tamanho da imagem ' + alt"
      [attr.aria-valuemin]="min" [attr.aria-valuemax]="max" [attr.aria-valuenow]="width"
      title="Arraste para redimensionar"
      (pointerdown)="startResize($event)"
      (keydown)="onHandleKey($event)"
      (dblclick)="reset()">
      <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
    </span>
  `,
  styles: [`
    :host { position: relative; display: block; max-width: 100%; border-radius: 8px; overflow: hidden; background: var(--surface-3); user-select: none; -webkit-user-select: none; }
    :host(.resizing) { outline: 2px solid var(--accent); outline-offset: 1px; cursor: nwse-resize; img { pointer-events: none; } }
    img { display: block; width: 100%; height: auto; max-height: 70vh; object-fit: cover; cursor: zoom-in; opacity: 0; transition: opacity .2s; &.ready { opacity: 1; } }
    .ri-handle {
      position: absolute; right: 4px; bottom: 4px; width: 26px; height: 26px; border-radius: 7px;
      display: grid; place-items: center; background: rgba(17,17,17,.68); color: #fff; font-size: 10px;
      cursor: nwse-resize; touch-action: none; opacity: 0; transition: opacity .15s;
      &:focus-visible { opacity: 1; outline: 2px solid var(--accent); }
    }
    :host(:hover) .ri-handle, :host(.resizing) .ri-handle { opacity: 1; }
    /* telas de toque não têm hover: o puxador fica sempre visível */
    @media (hover: none) { .ri-handle { opacity: .9; width: 32px; height: 32px; } }
  `],
})
export class ResizableImageComponent implements OnInit {
  @Input({ required: true }) src!: string;
  @Input() alt = '';
  /** chave para lembrar o tamanho (ex.: id do anexo) */
  @Input() storageKey?: string | number;
  @Input() min = 80;
  @Input() max = 720;
  @Input() defaultWidth = 160;
  /** área que limita a largura máxima (padrão: o pai). O pai que se ajusta ao conteúdo não serve. */
  @Input() boundary?: HTMLElement;
  @Output() open = new EventEmitter<void>();

  @HostBinding('style.width.px') width = 160;
  @HostBinding('class.resizing') resizing = false;

  loaded = false;
  /** arrastou de verdade? então o "click" que vem depois não abre a imagem */
  private moved = false;

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    this.width = this.clamp(this.readSaved() ?? this.defaultWidth);
  }

  startResize(e: PointerEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = this.width;
    this.resizing = true;
    this.moved = false;

    const onMove = (ev: PointerEvent) => {
      // diagonal: usa o maior deslocamento, assim arrastar para baixo também aumenta
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const delta = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
      if (Math.abs(delta) > 2) this.moved = true;
      this.width = this.clamp(startW + delta);
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      this.resizing = false;
      this.save();
      // o click sintético chega logo depois do pointerup
      setTimeout(() => (this.moved = false));
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  onHandleKey(e: KeyboardEvent): void {
    const step = e.shiftKey ? 60 : 20;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') this.width = this.clamp(this.width + step);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') this.width = this.clamp(this.width - step);
    else if (e.key === 'Enter' || e.key === ' ') { this.open.emit(); }
    else return;
    e.preventDefault();
    this.save();
  }

  reset(): void {
    this.width = this.clamp(this.defaultWidth);
    try { if (this.storageKey != null) localStorage.removeItem(STORAGE_PREFIX + this.storageKey); } catch { /* sem storage */ }
  }

  onImageClick(): void {
    if (!this.moved) this.open.emit();
  }

  /** não passa da largura disponível (no celular, a coluna é estreita) */
  private clamp(w: number): number {
    const area = this.boundary ?? this.host.nativeElement.parentElement;
    const available = area?.clientWidth || this.max;
    return Math.round(Math.max(this.min, Math.min(w, this.max, available)));
  }

  private readSaved(): number | null {
    try {
      if (this.storageKey == null) return null;
      const v = Number(localStorage.getItem(STORAGE_PREFIX + this.storageKey));
      return Number.isFinite(v) && v > 0 ? v : null;
    } catch {
      return null;
    }
  }

  private save(): void {
    try { if (this.storageKey != null) localStorage.setItem(STORAGE_PREFIX + this.storageKey, String(this.width)); } catch { /* sem storage */ }
  }
}
