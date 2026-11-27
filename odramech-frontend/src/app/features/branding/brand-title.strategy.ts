import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { BrandingService } from './branding.service';

/** Título da aba com o nome da oficina no lugar de "Odramech" (quando houver tema). */
@Injectable({ providedIn: 'root' })
export class BrandTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly brand = inject(BrandingService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const t = this.buildTitle(snapshot);
    if (!t) return;
    this.title.setTitle(t);
    this.brand.retitle(t);
  }
}
