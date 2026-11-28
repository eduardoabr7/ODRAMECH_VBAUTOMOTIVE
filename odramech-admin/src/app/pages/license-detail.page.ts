import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Api, Toast } from '../core/api.service';
import { badgeOf, EVENT_LABEL, isForever, LicenseDetail, LicenseRow, money, Plan, STATUS_LABEL } from '../core/models';
import { ModuleContractsCard } from './module-contracts.card';

/** yyyy-mm-dd (input date) → ISO no fim do dia, horário de Brasília */
function endOfDayIso(date: string): string {
  return new Date(`${date}T23:59:59-03:00`).toISOString();
}
function toDateInput(iso: string | null | undefined): string {
  if (!iso || isForever(iso)) return '';
  const d = new Date(iso);
  const local = new Date(d.getTime() - 3 * 3_600_000);
  return local.toISOString().slice(0, 10);
}
function plusDays(days: number): string {
  return toDateInput(new Date(Date.now() + days * 86_400_000).toISOString());
}

@Component({
  selector: 'adm-license-detail',
  imports: [DatePipe, FormsModule, RouterLink, ModuleContractsCard],
  template: `
    <a routerLink="/licencas" class="back muted small">‹ Licenças</a>

    @if (loading()) {
      <p class="muted">Carregando…</p>
    } @else {
    @if (row(); as r) {
      <header class="head">
        <div>
          <div class="row title">
            <h1>{{ r.enterpriseName || 'Empresa #' + r.enterpriseId }}</h1>
            <span class="pill {{ badge().cls }}">{{ badge().label }}</span>
          </div>
          <p class="muted small">
            #{{ r.enterpriseId }}
            @if (r.cnpj) { · {{ r.cnpj }} }
            @if (r.email) { · {{ r.email }} }
          </p>
        </div>
      </header>

      @if (d(); as d) {
        <!-- ═══ Resumo ═══ -->
        <section class="card summary">
          <div><span>Plano</span><strong>{{ d.plan?.name ?? '—' }}</strong><em>{{ d.plan ? money(d.plan.priceCents) + '/mês' : '' }}</em></div>
          <div><span>Status de cobrança</span><strong>{{ statusLabel(d) }}</strong><em>{{ d.access?.reason }}</em></div>
          <div><span>Acesso vale até</span><strong class="mono">{{ untilLabel(d) }}</strong>
            <em>{{ d.subscription!.cancelAtPeriodEnd ? 'cancelamento agendado' : '' }}</em></div>
          <div><span>Cliente desde</span><strong class="mono">{{ d.subscription!.createdAt | date: 'dd/MM/yyyy' }}</strong></div>
        </section>
      }

      <div class="cols">
        <div class="stack">
          <!-- ═══ Cortesia ═══ -->
          <section class="card card-pad box violet">
            <h3>Licença cortesia</h3>
            <p class="muted small">Acesso sem cobrança, no plano escolhido. Ideal para família, parceiros e testes longos.</p>
            @if (d()?.subscription?.complimentary && d()?.access?.level === 'full') {
              <p class="state">Cortesia ativa no plano <b>{{ d()!.plan?.name }}</b>, {{ untilLabel(d()!) === 'sem prazo' ? 'sem prazo' : 'até ' + untilLabel(d()!) }}.</p>
            }
            <div class="grid-2">
              <label class="field">Plano
                <select [(ngModel)]="comp.planCode">
                  @for (p of activePlans(); track p.id) { <option [value]="p.code">{{ p.name }}</option> }
                </select>
              </label>
              <label class="field">Até
                <input type="date" [(ngModel)]="comp.until" [disabled]="comp.forever" [min]="today">
              </label>
            </div>
            <label class="check"><input type="checkbox" [(ngModel)]="comp.forever"> Sem prazo (não expira)</label>
            <div class="row actions">
              <button class="btn primary" (click)="grantComplimentary()" [disabled]="busy() || (!comp.forever && !comp.until)">
                {{ d()?.subscription?.complimentary ? 'Atualizar cortesia' : 'Conceder cortesia' }}
              </button>
              @if (d()?.subscription?.complimentary) {
                <button class="btn danger" (click)="revokeComplimentary()" [disabled]="busy()">Encerrar cortesia</button>
              }
            </div>
          </section>

          @if (d(); as d) {
            <!-- ═══ Plano ═══ -->
            <section class="card card-pad box">
              <h3>Trocar plano agora</h3>
              <p class="muted small">Muda o plano na hora, sem gerar fatura. O preço da próxima renovação segue o plano novo.</p>
              <div class="row">
                <select [(ngModel)]="planCode">
                  @for (p of activePlans(); track p.id) { <option [value]="p.code">{{ p.name }} · {{ money(p.priceCents) }}</option> }
                </select>
                <button class="btn dark" (click)="changePlan()" [disabled]="busy() || planCode === d.plan?.code">Aplicar</button>
              </div>
            </section>

            <!-- ═══ Prazo ═══ -->
            @if (!d.subscription!.complimentary) {
              <section class="card card-pad box">
                <h3>Prazo</h3>
                <p class="muted small">Estende (ou encurta) o teste ou o período atual. Reabre o acesso se estiver expirada.</p>
                <div class="grid-2">
                  <label class="field">Acesso até
                    <input type="date" [(ngModel)]="period.until">
                  </label>
                  <label class="field">Como
                    <select [(ngModel)]="period.status">
                      <option value="">Manter situação</option>
                      <option value="TRIALING">Teste grátis</option>
                      <option value="ACTIVE">Ativa (como se estivesse paga)</option>
                    </select>
                  </label>
                </div>
                <div class="row quick">
                  <span class="muted small">Atalhos:</span>
                  <button class="btn sm ghost" (click)="period.until = plus(7)">+7 dias</button>
                  <button class="btn sm ghost" (click)="period.until = plus(30)">+30 dias</button>
                  <button class="btn sm ghost" (click)="period.until = plus(365)">+1 ano</button>
                </div>
                <button class="btn dark" (click)="setPeriod()" [disabled]="busy() || !period.until">Definir prazo</button>
              </section>
            }
          } @else {
            <!-- ═══ Sem licença ainda ═══ -->
            <section class="card card-pad box">
              <h3>Teste grátis</h3>
              <p class="muted small">Esta oficina ainda não tem licença (nunca acessou o sistema).</p>
              <div class="row">
                <input type="number" min="1" max="365" [(ngModel)]="trialDays" style="max-width: 110px">
                <span class="muted">dias</span>
                <button class="btn dark" (click)="startTrial()" [disabled]="busy()">Iniciar teste</button>
              </div>
            </section>
          }
        </div>

        <div class="stack">
          @if (d(); as d) {
            <!-- ═══ Suspensão ═══ -->
            <section class="card card-pad box" [class.danger-box]="d.subscription!.suspended">
              <h3>Suspensão</h3>
              @if (d.subscription!.suspended) {
                <p class="state bad">Suspensa{{ d.subscription!.suspendedReason ? ': ' + d.subscription!.suspendedReason : '' }}. A oficina está em modo somente leitura e não consegue pagar para sair.</p>
                <button class="btn" (click)="unsuspend()" [disabled]="busy()">Remover suspensão</button>
              } @else {
                <p class="muted small">Bloqueia tudo na hora, mesmo com pagamento em dia (fraude, chargeback, pedido do cliente…).</p>
                <label class="field">Motivo (a oficina vê)
                  <input [(ngModel)]="suspendReason" maxlength="300" placeholder="ex.: contestação de pagamento">
                </label>
                <button class="btn danger" (click)="suspend()" [disabled]="busy()">Suspender licença</button>
              }
            </section>

            <!-- ═══ Anotação ═══ -->
            <section class="card card-pad box">
              <h3>Anotação interna</h3>
              <p class="muted small">Só você vê. Nunca é enviada para a oficina.</p>
              <textarea [(ngModel)]="note" maxlength="2000" placeholder="ex.: licença do meu pai — não cobrar"></textarea>
              <button class="btn" (click)="saveNote()" [disabled]="busy() || note === (d.subscription!.adminNote ?? '')">Salvar anotação</button>
            </section>
          }
        </div>
      </div>

      <!-- ═══ Módulos adicionais (contrato à parte) ═══ -->
      <adm-module-contracts [enterpriseId]="r.enterpriseId" [enterpriseName]="r.enterpriseName" />

      @if (d(); as d) {
        <!-- ═══ Faturas ═══ -->
        <section class="card section">
          <div class="card-pad"><h2>Faturas</h2></div>
          @if (d.invoices.length) {
            <table class="grid">
              <thead><tr><th>Nº</th><th>Plano</th><th>Valor</th><th>Período</th><th>Situação</th><th></th></tr></thead>
              <tbody>
                @for (i of d.invoices; track i.id) {
                  <tr>
                    <td class="mono">{{ i.number }}</td>
                    <td>{{ i.planCode }}</td>
                    <td class="mono">{{ money(i.amountCents) }}</td>
                    <td class="mono small">{{ i.periodStart | date: 'dd/MM/yy' }} → {{ i.periodEnd | date: 'dd/MM/yy' }}</td>
                    <td>
                      @switch (i.status) {
                        @case ('PAID') { <span class="pill paid">Paga {{ i.paidAt | date: 'dd/MM' }}</span> }
                        @case ('OPEN') { <span class="pill grace">Em aberto</span> }
                        @default { <span class="pill none">Anulada</span> }
                      }
                    </td>
                    <td class="right">
                      @if (i.status === 'OPEN') {
                        <button class="btn sm" (click)="markPaid(i.id)" [disabled]="busy()" title="Recebeu por fora (transferência, dinheiro…)">Marcar paga</button>
                        <button class="btn sm ghost" (click)="voidInvoice(i.id)" [disabled]="busy()">Anular</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="empty">Nenhuma fatura.</p>
          }
        </section>

        <!-- ═══ Auditoria ═══ -->
        <section class="card section">
          <div class="card-pad"><h2>Histórico</h2><p class="muted small">Tudo o que aconteceu com esta licença — inclusive suas ações no painel.</p></div>
          <ol class="timeline">
            @for (e of d.events; track e.id) {
              <li [class.admin]="e.type.startsWith('license.')" [class.alert]="e.type === 'invoice.amount_mismatch'">
                <span class="mono when">{{ e.createdAt | date: 'dd/MM/yy HH:mm' }}</span>
                <span>{{ label(e.type) }}</span>
                <span class="muted small">{{ detail(e.payload) }}</span>
              </li>
            }
          </ol>
        </section>
      }
    } @else {
      <p class="empty">Oficina não encontrada.</p>
    }
    }
  `,
  styles: `
    .back { text-decoration: none; display: inline-block; margin-bottom: 10px; }
    .back:hover { color: var(--ink); }
    .head { margin-bottom: 16px; }
    .title { gap: 12px; flex-wrap: wrap; }
    .head p { margin: 4px 0 0; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); margin-bottom: 16px; }
    .summary > div { padding: 14px 18px; display: grid; gap: 2px; border-left: 1px solid var(--line); }
    .summary > div:first-child { border-left: 0; }
    .summary span { font-size: 12px; color: var(--muted); }
    .summary strong { font-size: 15.5px; }
    .summary em { font-style: normal; font-size: 12px; color: var(--faint); min-height: 1em; }
    .cols { display: grid; grid-template-columns: 1.15fr 1fr; gap: 14px; align-items: start; }
    .stack { display: grid; gap: 14px; }
    .box { display: grid; gap: 12px; }
    .box p { margin: -6px 0 0; }
    .box.violet { border-top: 3px solid var(--violet); }
    .danger-box { border-color: color-mix(in srgb, var(--danger) 40%, transparent); background: #fffafa; }
    .state { margin: 0 !important; padding: 9px 12px; border-radius: var(--r); background: var(--violet-soft); color: var(--violet); font-size: 13px; }
    .state.bad { background: var(--danger-soft); color: var(--danger); }
    .check { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
    .actions { flex-wrap: wrap; }
    .quick { gap: 4px; flex-wrap: wrap; }
    .box > .btn { justify-self: start; }
    .row select { flex: 1; }
    .section { margin-top: 16px; }
    .section .card-pad p { margin: 4px 0 0; }
    .right { text-align: right; white-space: nowrap; }
    .timeline { list-style: none; margin: 0; padding: 0 20px 16px; }
    .timeline li { display: grid; grid-template-columns: 130px 1fr; column-gap: 12px; padding: 8px 0 8px 14px; border-left: 2px solid var(--line); position: relative; }
    .timeline li::before { content: ''; position: absolute; left: -5px; top: 14px; width: 8px; height: 8px; border-radius: 50%; background: var(--line-strong); }
    .timeline li.admin::before { background: var(--violet); }
    .timeline li.alert { color: var(--danger); font-weight: 600; }
    .timeline li.alert::before { background: var(--danger); }
    .timeline .when { color: var(--muted); grid-row: span 2; }
    @media (max-width: 900px) {
      .cols { grid-template-columns: 1fr; }
      .summary { grid-template-columns: 1fr 1fr; }
      .summary > div:nth-child(3) { border-left: 0; }
      .summary > div:nth-child(n+3) { border-top: 1px solid var(--line); }
    }
    @media (max-width: 560px) { .timeline li { grid-template-columns: 1fr; } .timeline .when { grid-row: auto; } }
  `,
})
export class LicenseDetailPage implements OnInit {
  private readonly api = inject(Api);
  private readonly toast = inject(Toast);

  readonly enterpriseId = input.required<string>();

  readonly d = signal<LicenseDetail | null>(null);
  /** empresa sem licença: só a linha da lista */
  readonly bare = signal<LicenseRow | null>(null);
  readonly row = computed<LicenseRow | null>(() => this.d() ?? this.bare());
  readonly badge = computed(() => (this.row() ? badgeOf(this.row()!) : { cls: 'none', label: '' }));
  readonly plans = signal<Plan[]>([]);
  readonly activePlans = computed(() => this.plans().filter(p => p.active));
  readonly loading = signal(true);
  readonly busy = signal(false);

  readonly money = money;
  readonly today = plusDays(1);
  readonly plus = plusDays;

  comp = { planCode: 'INTERMEDIARIO', until: '', forever: true };
  planCode = '';
  period: { until: string; status: '' | 'TRIALING' | 'ACTIVE' } = { until: '', status: '' };
  suspendReason = '';
  note = '';
  trialDays = 7;

  private get id() { return Number(this.enterpriseId()); }

  async ngOnInit() {
    try {
      this.plans.set(await this.api.plans());
      await this.reload();
    } finally {
      this.loading.set(false);
    }
  }

  private async reload() {
    try {
      this.apply(await this.api.license(this.id));
    } catch (err) {
      if ((err as HttpErrorResponse).status === 404) {
        const list = await this.api.licenses();
        this.bare.set(list.licenses.find(l => l.enterpriseId === this.id) ?? null);
        this.d.set(null);
      } else {
        this.toast.error(err);
      }
    }
  }

  private apply(detail: LicenseDetail | null) {
    if (!detail) return;
    this.d.set(detail);
    const s = detail.subscription!;
    this.planCode = detail.plan?.code ?? '';
    this.note = s.adminNote ?? '';
    this.period = { until: toDateInput(s.currentPeriodEnd), status: '' };
    if (s.complimentary) {
      this.comp = { planCode: detail.plan?.code ?? 'INTERMEDIARIO', until: toDateInput(s.complimentaryUntil), forever: !s.complimentaryUntil };
    } else {
      this.comp = { ...this.comp, planCode: detail.plan?.code ?? this.comp.planCode };
    }
  }

  private async run(action: () => Promise<LicenseDetail | null>, ok: string) {
    this.busy.set(true);
    try {
      const result = await action();
      if (result) { this.apply(result); this.bare.set(null); } else { await this.reload(); }
      this.toast.show(ok);
    } catch (err) {
      this.toast.error(err);
    } finally {
      this.busy.set(false);
    }
  }

  grantComplimentary() {
    const until = this.comp.forever ? null : endOfDayIso(this.comp.until);
    return this.run(
      () => this.api.grantComplimentary(this.id, { planCode: this.comp.planCode, until, enterpriseName: this.row()?.enterpriseName ?? undefined }),
      'Cortesia salva.',
    );
  }

  revokeComplimentary() {
    if (!confirm('Encerrar a cortesia agora? A oficina fica bloqueada (somente leitura) até assinar um plano.')) return;
    return this.run(() => this.api.revokeComplimentary(this.id), 'Cortesia encerrada.');
  }

  changePlan() {
    return this.run(() => this.api.changePlan(this.id, this.planCode), 'Plano alterado.');
  }

  setPeriod() {
    return this.run(() => this.api.setPeriod(this.id, endOfDayIso(this.period.until), this.period.status || undefined), 'Prazo atualizado.');
  }

  startTrial() {
    return this.run(() => this.api.startTrial(this.id, { days: this.trialDays, enterpriseName: this.row()?.enterpriseName ?? undefined }), 'Teste grátis iniciado.');
  }

  suspend() {
    if (!confirm('Suspender esta licença? A oficina passa para somente leitura imediatamente.')) return;
    return this.run(() => this.api.suspend(this.id, this.suspendReason.trim()), 'Licença suspensa.');
  }

  unsuspend() {
    return this.run(() => this.api.unsuspend(this.id), 'Suspensão removida.');
  }

  saveNote() {
    return this.run(() => this.api.setNote(this.id, this.note), 'Anotação salva.');
  }

  markPaid(invoiceId: string) {
    if (!confirm('Marcar esta fatura como paga? Use só se você recebeu o valor por fora (transferência, dinheiro…).')) return;
    return this.run(() => this.api.markPaid(invoiceId), 'Fatura marcada como paga.');
  }

  voidInvoice(invoiceId: string) {
    if (!confirm('Anular esta fatura em aberto?')) return;
    return this.run(() => this.api.voidInvoice(invoiceId), 'Fatura anulada.');
  }

  statusLabel(d: LicenseDetail) {
    const s = d.subscription!;
    if (s.suspended) return 'Suspensa';
    if (s.complimentary && d.access?.level === 'full') return 'Cortesia';
    return STATUS_LABEL[s.status];
  }

  untilLabel(d: LicenseDetail) {
    const s = d.subscription!;
    if (s.complimentary && !s.complimentaryUntil) return 'sem prazo';
    const iso = s.complimentaryUntil ?? s.currentPeriodEnd;
    return isForever(iso) ? 'sem prazo' : new Date(iso).toLocaleDateString('pt-BR');
  }

  label(type: string) { return EVENT_LABEL[type] ?? type; }

  detail(p: Record<string, unknown> | null): string {
    if (!p) return '';
    const parts: string[] = [];
    if (typeof p['actor'] === 'string') parts.push(String(p['actor']).replace(/^admin:\d+ /, 'por '));
    if (p['planCode']) parts.push(`plano ${p['planCode']}`);
    if (p['reason']) parts.push(String(p['reason']));
    if (p['until']) parts.push(`até ${new Date(String(p['until'])).toLocaleDateString('pt-BR')}`);
    if (p['amountCents']) parts.push(money(Number(p['amountCents'])));
    if (p['expectedCents']) parts.push(`esperado ${money(Number(p['expectedCents']))}, pago ${money(Number(p['paidCents']))}`);
    return parts.join(' · ');
  }
}
