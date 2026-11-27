import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, Toast } from '../core/api.service';
import { badgeOf, isForever, LicenseRow } from '../core/models';

type Filter = 'all' | 'paid' | 'trial' | 'complimentary' | 'grace' | 'blocked' | 'none';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'paid', label: 'Pagas' },
  { key: 'trial', label: 'Em teste' },
  { key: 'complimentary', label: 'Cortesia' },
  { key: 'grace', label: 'Em tolerância' },
  { key: 'blocked', label: 'Bloqueadas' },
  { key: 'none', label: 'Sem licença' },
];

@Component({
  selector: 'adm-licenses',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="head">
      <h1>Licenças</h1>
      <p class="muted">Clique numa oficina para conceder cortesia, trocar plano, estender prazo ou suspender.</p>
    </header>

    <div class="tools">
      <input class="search" type="search" placeholder="Buscar por nome, CNPJ, e-mail ou nº da empresa" [ngModel]="search()" (ngModelChange)="search.set($event)">
      <div class="chips">
        @for (f of filters; track f.key) {
          <button class="chip" [class.on]="active() === f.key" (click)="active.set(f.key)">
            {{ f.label }} <span>{{ count(f.key) }}</span>
          </button>
        }
      </div>
    </div>

    @if (!directoryAvailable()) {
      <p class="note">Não consegui falar com o backend da oficina: a lista mostra só quem já tem licença.</p>
    }

    <section class="card">
      @if (loading()) {
        <p class="empty">Carregando…</p>
      } @else if (visible().length) {
        <table class="grid">
          <thead>
            <tr><th>Oficina</th><th>Situação</th><th>Plano</th><th>Vale até</th><th></th></tr>
          </thead>
          <tbody>
            @for (r of visible(); track r.enterpriseId) {
              <tr class="link" [routerLink]="['/licencas', r.enterpriseId]">
                <td>
                  <strong>{{ r.enterpriseName || 'Empresa #' + r.enterpriseId }}</strong>
                  <div class="muted small">#{{ r.enterpriseId }}{{ r.cnpj ? ' · ' + r.cnpj : '' }}</div>
                </td>
                <td><span class="pill {{ badge(r).cls }}">{{ badge(r).label }}</span></td>
                <td>{{ r.plan?.name ?? '—' }}</td>
                <td class="mono">{{ until(r) }}</td>
                <td class="go">›</td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <p class="empty">Nenhuma oficina encontrada.</p>
      }
    </section>
  `,
  styles: `
    .head { margin-bottom: 18px; }
    .head p { margin: 4px 0 0; }
    .tools { display: grid; gap: 10px; margin-bottom: 14px; }
    .search { height: 40px; max-width: 460px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { height: 30px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--surface); font: 500 12.5px var(--font); cursor: pointer; color: var(--muted); }
    .chip span { margin-left: 4px; color: var(--faint); font-variant-numeric: tabular-nums; }
    .chip.on { background: var(--ink); border-color: var(--ink); color: #fff; }
    .chip.on span { color: #bbb; }
    .note { padding: 10px 14px; border-radius: var(--r); background: var(--warn-soft); color: var(--warn); font-size: 13px; margin: 0 0 14px; }
    .go { width: 24px; color: var(--faint); font-size: 18px; }
    @media (max-width: 640px) { table.grid th:nth-child(3), table.grid td:nth-child(3) { display: none; } }
  `,
})
export class LicensesPage implements OnInit {
  private readonly api = inject(Api);
  private readonly toast = inject(Toast);

  /** ?filtro= vindo da visão geral */
  readonly filtro = input<string | undefined>();

  readonly filters = FILTERS;
  readonly rows = signal<LicenseRow[]>([]);
  readonly directoryAvailable = signal(true);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly active = signal<Filter>('all');
  readonly badge = badgeOf;

  readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    return this.rows().filter(r => this.matches(r, this.active())).filter(r => {
      if (!term) return true;
      return (r.enterpriseName ?? '').toLowerCase().includes(term)
        || (r.email ?? '').toLowerCase().includes(term)
        || String(r.enterpriseId) === term
        || (!!digits && (r.cnpj ?? '').replace(/\D/g, '').includes(digits));
    });
  });

  async ngOnInit() {
    const f = this.filtro();
    if (f && FILTERS.some(x => x.key === f)) this.active.set(f as Filter);
    try {
      const r = await this.api.licenses();
      this.rows.set(r.licenses);
      this.directoryAvailable.set(r.directoryAvailable);
    } catch (err) {
      this.toast.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  count(f: Filter) { return this.rows().filter(r => this.matches(r, f)).length; }

  private matches(r: LicenseRow, f: Filter): boolean {
    switch (f) {
      case 'all': return true;
      case 'none': return r.kind === 'none';
      case 'blocked': return r.kind === 'suspended' || r.access?.level === 'blocked';
      case 'grace': return r.access?.level === 'grace';
      default: return r.kind === f && r.access?.level === 'full';
    }
  }

  until(r: LicenseRow): string {
    const s = r.subscription;
    if (!s) return '—';
    if (s.complimentary && (!s.complimentaryUntil || isForever(s.currentPeriodEnd))) return 'sem prazo';
    const d = new Date(s.complimentaryUntil ?? s.currentPeriodEnd);
    return d.toLocaleDateString('pt-BR');
  }
}
