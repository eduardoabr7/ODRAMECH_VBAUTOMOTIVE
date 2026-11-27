import { Component, Inject, Input, OnChanges, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillingService } from '@shared/services/billing.service';

/** Bloco de notas pessoal, salvo no banco (tabela user_notes) por usuário + estabelecimento. */
@Component({
  selector: 'app-user-reminders',
  imports: [CommonModule, FormsModule],
  templateUrl: './user-reminders.component.html',
  styleUrl: './user-reminders.component.scss'
})
export class UserRemindersComponent implements OnChanges, OnDestroy {
  @Input() userId?: number | null;

  text = '';
  savedAt: Date | null = null;
  state: 'idle' | 'saving' | 'error' = 'idle';
  loaded = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;

  constructor(@Inject(PLATFORM_ID) private readonly platformId: object, private readonly _billing: BillingService) {}

  private get legacyKey(): string { return `odramech:notes:${this.userId ?? 'anon'}`; }

  ngOnChanges(): void {
    if (!isPlatformBrowser(this.platformId) || !this.userId) return;
    this._billing.getNote().subscribe({
      next: note => {
        this.loaded = true;
        this.text = note.content ?? '';
        this.savedAt = note.updatedAt ? new Date(note.updatedAt) : null;
        this.migrateLegacy();
      },
      error: () => { this.loaded = true; this.state = 'error'; },
    });
  }

  /** Versões anteriores guardavam no navegador; se o banco estiver vazio, sobe o texto antigo. */
  private migrateLegacy(): void {
    try {
      const raw = localStorage.getItem(this.legacyKey);
      if (!raw) return;
      const legacy = JSON.parse(raw)?.text ?? '';
      if (legacy && !this.text) {
        this.text = legacy;
        this.persist();
      }
      localStorage.removeItem(this.legacyKey);
    } catch { /* storage indisponível */ }
  }

  onInput(): void {
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.persist(), 700);
  }

  private persist(): void {
    this.dirty = false;
    this.state = 'saving';
    this._billing.saveNote(this.text).subscribe({
      next: n => { this.state = 'idle'; this.savedAt = new Date(n.updatedAt); },
      error: () => { this.state = 'error'; this.dirty = true; },
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.dirty) this.persist();
  }
}
