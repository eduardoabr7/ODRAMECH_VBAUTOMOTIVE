import { Directive, ElementRef, OnDestroy, OnInit } from '@angular/core';

/**
 * Move o elemento para o <body>. Overlays com position: fixed dentro de um ancestral com
 * transform (ex.: animação .reveal) ficam presos nele; no body cobrem a tela toda.
 * O Angular continua dono do nó (bindings e destruição funcionam normalmente).
 */
@Directive({ selector: '[appBodyPortal]', standalone: true })
export class BodyPortalDirective implements OnInit, OnDestroy {
  constructor(private readonly el: ElementRef<HTMLElement>) {}

  ngOnInit(): void { document.body.appendChild(this.el.nativeElement); }

  ngOnDestroy(): void { this.el.nativeElement.remove(); }
}
