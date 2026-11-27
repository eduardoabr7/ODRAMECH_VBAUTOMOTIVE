import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Branding } from '@shared/models/Settings';
import { SettingsService } from '@shared/services/settings.service';

export const DEFAULT_BRAND = {
  name: 'Odramech',
  logo: 'assets/circle-sem-fundo-odramech-orange.png',
  accent: '#e4531c',
};

// chaves de quando a marca ficava salva no navegador; só apagamos se ainda existirem
const LEGACY_KEYS = ['odramech.brandingKey', 'odramech.brandingCache'];

// tema da empresa: cor nas variáveis CSS e nome da oficina no menu e na aba
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly api = inject(SettingsService);
  private readonly doc = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** tema completo da empresa logada (null antes do login) */
  readonly branding = signal<Branding | null>(null);

  readonly name = computed(() => this.branding()?.displayName || this.branding()?.enterpriseName || DEFAULT_BRAND.name);
  readonly logo = computed(() => this.branding()?.logoUrl || DEFAULT_BRAND.logo);
  readonly hasCustomLogo = computed(() => !!this.branding()?.logoUrl);

  constructor() {
    if (this.isBrowser) {
      try { LEGACY_KEYS.forEach(k => localStorage.removeItem(k)); } catch { /* armazenamento bloqueado */ }
    }
  }

  /** carrega o tema da empresa da sessão (chamado pelo layout depois do login) */
  load(): void {
    this.api.getBranding().subscribe({
      next: b => this.set(b),
      error: () => { /* sem tema: segue o padrão Odramech */ },
    });
  }

  set(b: Branding | null): void {
    this.branding.set(b);
    this.applyAccent(b?.accentColor ?? null);
    this.retitle();
  }

  // volta tudo pro Odramech (chamado no logout e ao abrir o login)
  reset(pageTitle = 'Entrar · Odramech'): void {
    this.branding.set(null);
    this.applyAccent(null);
    void this.setFavicon(null);
    if (this.isBrowser) this.title.setTitle(pageTitle);
  }

  /** link de login com a marca da empresa */
  loginLink(): string | null {
    const key = this.branding()?.publicKey;
    if (!key || !this.isBrowser) return null;
    return `${this.doc.location.origin}/login?marca=${key}`;
  }

  // cor de destaque
  applyAccent(hex: string | null): void {
    if (!this.isBrowser) return;
    const root = this.doc.documentElement.style;
    if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) {
      ['--accent', '--accent-hover', '--accent-soft', '--accent-ring'].forEach(v => root.removeProperty(v));
      return;
    }
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const darker = [r, g, b].map(c => Math.round(c * 0.86));
    const soft = [r, g, b].map(c => Math.round(255 - (255 - c) * 0.12));
    root.setProperty('--accent', hex);
    root.setProperty('--accent-hover', `rgb(${darker.join(',')})`);
    root.setProperty('--accent-soft', `rgb(${soft.join(',')})`);
    root.setProperty('--accent-ring', `rgba(${r},${g},${b},.22)`);
  }

  // favicon
  private faviconToken = 0;

  // troca o favicon (null = Odramech). Recorta em quadrado de 64px pra foto não distorcer
  async setFavicon(src: string | null): Promise<void> {
    if (!this.isBrowser) return;
    const token = ++this.faviconToken;
    let href = DEFAULT_BRAND.logo;
    if (src) {
      try { href = await squareIcon(src); } catch { href = DEFAULT_BRAND.logo; }
    }
    if (token !== this.faviconToken) return; // chegou uma troca mais nova enquanto processava
    const links = Array.from(this.doc.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]'));
    for (const link of links) {
      link.href = href;
      if (link.rel.includes('icon') && !link.rel.includes('apple')) link.type = href.startsWith('data:image/png') ? 'image/png' : '';
    }
  }

  /** depois do login: foto do estabelecimento > logo do tema da empresa > Odramech */
  faviconForSession(establishmentLogo: string | null | undefined): void {
    void this.setFavicon(establishmentLogo || this.branding()?.logoUrl || null);
  }

  /** "Orçamentos · Odramech" → "Orçamentos · Oficina do Zé" */
  retitle(current = this.title.getTitle()): void {
    const name = this.name();
    if (name === DEFAULT_BRAND.name) return;
    this.title.setTitle(current.replace(/Odramech$/, name));
  }
}

// recorta em quadrado de 64px com cantos arredondados e devolve PNG
function squareIcon(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 64, radius = 12;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      if (!g) { reject(new Error('canvas')); return; }
      g.beginPath();
      g.moveTo(radius, 0);
      g.arcTo(size, 0, size, size, radius);
      g.arcTo(size, size, 0, size, radius);
      g.arcTo(0, size, 0, 0, radius);
      g.arcTo(0, 0, size, 0, radius);
      g.closePath();
      g.clip();
      const s = Math.max(size / img.width, size / img.height);
      const w = img.width * s, h = img.height * s;
      g.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('imagem'));
    img.src = src;
  });
}
