import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ToastrService } from 'ngx-toastr';
import { SettingsService } from '@shared/services/settings.service';
import { SessionService } from '@shared/services/session.service';
import { Branding, BrandingUpdate } from '@shared/models/Settings';
import { BrandingService, DEFAULT_BRAND } from './branding.service';
import { imageToDataUrl } from '@shared/utils/image-data-url';

const PRESETS = ['#e4531c', '#d97706', '#16a34a', '#0f766e', '#2563eb', '#4f46e5', '#9333ea', '#db2777', '#dc2626', '#111111'];

/** Configurações → Tema e marca (logo, nome, cor e tela de login). */
@Component({
  selector: 'app-theme-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './theme-settings.component.html',
  styleUrl: './theme-settings.component.scss',
})
export class ThemeSettingsComponent implements OnInit, OnDestroy {
  private readonly api = inject(SettingsService);
  private readonly toastr = inject(ToastrService);
  readonly brand = inject(BrandingService);
  readonly isManager = toSignal(inject(SessionService).isManager$, { initialValue: false });

  readonly PRESETS = PRESETS;
  readonly DEFAULT = DEFAULT_BRAND;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly data = signal<Branding | null>(null);

  readonly displayName = signal('');
  readonly logoUrl = signal<string | null>(null);
  readonly accent = signal<string>(DEFAULT_BRAND.accent);
  readonly loginImageUrl = signal<string | null>(null);
  readonly loginHeadline = signal('');
  readonly loginSubtitle = signal('');
  readonly dirty = signal(false);

  readonly canLogin = computed(() => this.data()?.canCustomizeLogin ?? false);
  readonly readOnly = computed(() => !this.isManager());
  readonly previewName = computed(() => this.displayName().trim() || this.data()?.enterpriseName || DEFAULT_BRAND.name);
  readonly previewLogo = computed(() => this.logoUrl() || DEFAULT_BRAND.logo);
  readonly loginLink = computed(() => this.data()?.publicKey && typeof location !== 'undefined' ? `${location.origin}/login?marca=${this.data()!.publicKey}` : null);

  ngOnInit(): void {
    this.api.getBranding().subscribe({
      next: b => { this.apply(b); this.loading.set(false); },
      error: err => { this.loading.set(false); this.toastr.error(err?.error?.message ?? 'Não foi possível carregar o tema.'); },
    });
  }

  /** ao sair sem salvar, volta a cor que estava valendo */
  ngOnDestroy(): void {
    this.brand.applyAccent(this.brand.branding()?.accentColor ?? null);
  }

  private apply(b: Branding): void {
    this.data.set(b);
    this.displayName.set(b.displayName ?? '');
    this.logoUrl.set(b.logoUrl);
    this.accent.set(b.accentColor ?? DEFAULT_BRAND.accent);
    this.loginImageUrl.set(b.loginImageUrl);
    this.loginHeadline.set(b.loginHeadline ?? '');
    this.loginSubtitle.set(b.loginSubtitle ?? '');
    this.dirty.set(false);
  }

  touch(): void { this.dirty.set(true); }

  setAccent(hex: string): void {
    if (this.readOnly()) return;
    this.accent.set(hex);
    this.brand.applyAccent(hex); // prévia ao vivo no sistema todo
    this.touch();
  }

  async pickLogo(ev: Event): Promise<void> {
    const file = this.takeFile(ev);
    if (!file) return;
    try {
      this.logoUrl.set(await imageToDataUrl(file, { max: 512, keepTransparency: true, maxBytes: 1_000_000, allowSvg: true }));
      this.touch();
    } catch (e: any) { this.toastr.warning(e?.message ?? 'Imagem inválida.'); }
  }

  async pickLoginImage(ev: Event): Promise<void> {
    const file = this.takeFile(ev);
    if (!file) return;
    try {
      this.loginImageUrl.set(await imageToDataUrl(file, { max: 1920, keepTransparency: false, maxBytes: 3_000_000 }));
      this.touch();
    } catch (e: any) { this.toastr.warning(e?.message ?? 'Imagem inválida.'); }
  }

  private takeFile(ev: Event): File | null {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (file && !file.type.startsWith('image/')) { this.toastr.warning('Escolha um arquivo de imagem.'); return null; }
    return file;
  }

  removeLogo(): void { this.logoUrl.set(null); this.touch(); }
  removeLoginImage(): void { this.loginImageUrl.set(null); this.touch(); }

  resetAll(): void {
    if (!confirm('Voltar para o visual padrão do Odramech?')) return;
    this.displayName.set('');
    this.logoUrl.set(null);
    this.setAccent(DEFAULT_BRAND.accent);
    if (this.canLogin()) { this.loginImageUrl.set(null); this.loginHeadline.set(''); this.loginSubtitle.set(''); }
  }

  async copyLink(): Promise<void> {
    const link = this.loginLink();
    if (!link) return;
    try { await navigator.clipboard.writeText(link); this.toastr.success('Link copiado.'); }
    catch { this.toastr.info(link, 'Copie o link'); }
  }

  save(): void {
    if (this.readOnly() || this.saving()) return;
    const payload: BrandingUpdate = {
      displayName: this.displayName().trim() || null,
      logoUrl: this.logoUrl(),
      accentColor: this.accent().toLowerCase() === DEFAULT_BRAND.accent ? null : this.accent().toLowerCase(),
      // campos do login só vão quando o plano libera (senão o backend recusa)
      ...(this.canLogin() && {
        loginImageUrl: this.loginImageUrl(),
        loginHeadline: this.loginHeadline().trim() || null,
        loginSubtitle: this.loginSubtitle().trim() || null,
      }),
    };
    this.saving.set(true);
    this.api.saveBranding(payload).subscribe({
      next: b => {
        this.saving.set(false);
        this.apply(b);
        this.brand.set(b);
        this.toastr.success('Tema salvo.');
      },
      error: err => {
        this.saving.set(false);
        const detail = err?.error?.errors?.[0]?.constraints ? Object.values(err.error.errors[0].constraints)[0] as string : null;
        this.toastr.error(detail ?? err?.error?.message ?? 'Não foi possível salvar o tema.');
      },
    });
  }
}
