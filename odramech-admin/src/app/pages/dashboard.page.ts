import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Api, Toast } from '../core/api.service';
import { Dashboard, EVENT_LABEL, money } from '../core/models';

@Component({
  selector: 'adm-dashboard',
  imports: [DatePipe, RouterLink],
  template: `
    <header class="row head">
      <div>
        <h1>Visão geral</h1>
        <p class="muted">Licenças de todas as oficinas.</p>
      </div>
      <span class="spacer"></span>
      <button class="btn" (click)="runLifecycle()" [disabled]="running()" title="Aplica agora renovações, expirações e fim de testes">
        {{ running() ? 'Processando…' : 'Rodar ciclo de cobrança' }}
      </button>
    </header>

    @if (data(); as d) {
      <section class="kpis">
        <div class="card kpi"><span>Receita mensal recorrente</span><strong>{{ money(d.mrrCents) }}</strong><em>só assinaturas pagas e ativas</em></div>
        <a class="card kpi link" routerLink="/licencas" [queryParams]="{ filtro: 'paid' }"><span>Pagas</span><strong>{{ d.counts.active }}</strong></a>
        <a class="card kpi link" routerLink="/licencas" [queryParams]="{ filtro: 'trial' }"><span>Em teste</span><strong>{{ d.counts.trial }}</strong></a>
        <a class="card kpi link" routerLink="/licencas" [queryParams]="{ filtro: 'complimentary' }"><span>Cortesia</span><strong>{{ d.counts.complimentary }}</strong></a>
        <a class="card kpi link warn" routerLink="/licencas" [queryParams]="{ filtro: 'grace' }"><span>Em tolerância</span><strong>{{ d.counts.grace }}</strong></a>
        <a class="card kpi link bad" routerLink="/licencas" [queryParams]="{ filtro: 'blocked' }"><span>Bloqueadas / suspensas</span><strong>{{ d.counts.blocked + d.counts.suspended }}</strong></a>
      </section>

      <section class="card">
        <div class="card-pad row"><h2>Atividade recente</h2></div>
        @if (d.recentEvents.length) {
          <table class="grid">
            <tbody>
              @for (e of d.recentEvents; track e.id) {
                <tr class="link" [routerLink]="e.enterpriseId ? ['/licencas', e.enterpriseId] : null">
                  <td class="when mono">{{ e.createdAt | date: 'dd/MM HH:mm' }}</td>
                  <td><strong>{{ e.enterpriseName || ('Empresa #' + e.enterpriseId) }}</strong></td>
                  <td [class.alert]="e.type === 'invoice.amount_mismatch'">{{ label(e.type) }}</td>
                  <td class="muted small actor">{{ actor(e) }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="empty">Nada por aqui ainda.</p>
        }
      </section>
    } @else {
      <p class="muted">Carregando…</p>
    }
  `,
  styles: `
    .head { margin-bottom: 22px; align-items: flex-start; }
    .head p { margin: 4px 0 0; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 18px; }
    .kpi { padding: 14px 16px; display: grid; gap: 2px; text-decoration: none; }
    .kpi span { font-size: 12.5px; color: var(--muted); font-weight: 500; }
    .kpi strong { font-size: 24px; font-weight: 650; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
    .kpi em { font-style: normal; font-size: 11.5px; color: var(--faint); }
    .kpi:first-child { grid-column: span 2; background: var(--sidebar); color: var(--on-dark); border-color: var(--sidebar); }
    .kpi:first-child span, .kpi:first-child em { color: var(--on-dark-muted); }
    .kpi.link { transition: border-color .15s, transform .15s; }
    .kpi.link:hover { border-color: var(--line-strong); transform: translateY(-1px); }
    .kpi.warn strong { color: var(--warn); }
    .kpi.bad strong { color: var(--danger); }
    .when { width: 110px; color: var(--muted); }
    .actor { text-align: right; }
    .alert { color: var(--danger); font-weight: 600; }
    @media (max-width: 600px) { .kpi:first-child { grid-column: 1 / -1; } .actor { display: none; } }
  `,
})
export class DashboardPage implements OnInit {
  private readonly api = inject(Api);
  private readonly toast = inject(Toast);
  readonly data = signal<Dashboard | null>(null);
  readonly running = signal(false);
  readonly money = money;

  async ngOnInit() {
    try { this.data.set(await this.api.dashboard()); } catch (err) { this.toast.error(err); }
  }

  label(type: string) { return EVENT_LABEL[type] ?? type; }
  actor(e: { payload: Record<string, unknown> | null }) {
    const a = e.payload?.['actor'];
    return typeof a === 'string' ? a.replace(/^admin:\d+ /, 'por ') : '';
  }

  async runLifecycle() {
    this.running.set(true);
    try {
      const r = await this.api.runLifecycle();
      this.toast.show(`Ciclo processado: ${r.ok} alteração(ões)${r.failed ? `, ${r.failed} com erro` : ''}.`);
      this.data.set(await this.api.dashboard());
    } catch (err) { this.toast.error(err); } finally { this.running.set(false); }
  }
}
