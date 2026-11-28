import { Component, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api, Toast } from '../core/api.service';
import { MODULE_EVENT_LABEL, ModuleContractView, money } from '../core/models';

/** yyyy-mm-dd → fim do dia (Brasília) em ISO */
const endOfDayIso = (date: string) => new Date(`${date}T23:59:59-03:00`).toISOString();
const toDateInput = (iso: string | null | undefined) =>
  iso ? new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10) : '';
const plusDays = (days: number) => toDateInput(new Date(Date.now() + days * 86_400_000).toISOString());

interface Draft { until: string; forever: boolean; price: number | null; note: string; reason: string; open: boolean }

/**
 * Contratos de MÓDULOS ADICIONAIS (ex.: Estoque) de uma oficina.
 * Contrato à parte da assinatura: tem prazo e valor próprios. O módulo só funciona com
 * a assinatura ativa E o contrato ativo. Toda ação vai para a auditoria com o seu e-mail.
 */
@Component({
  selector: 'adm-module-contracts',
  imports: [DatePipe, FormsModule],
  template: `
    <section class="card section">
      <div class="card-pad">
        <h2>Módulos contratados</h2>
        <p class="muted small">Contratos à parte da assinatura. A oficina só usa o módulo com a assinatura ativa <b>e</b> o contrato ativo.</p>
      </div>

      @for (m of modules(); track m.module) {
        <div class="mod card-pad">
          <div class="mod-head">
            <div>
              <strong>{{ m.name }}</strong>
              <span class="pill {{ m.access.active ? 'paid' : (m.contract?.status === 'SUSPENDED' ? 'suspended' : 'none') }}">
                {{ m.access.active ? 'Ativo' : (m.contract ? statusLabel(m) : 'Não contratado') }}
              </span>
            </div>
            <span class="muted small">{{ m.access.reason }}</span>
          </div>

          @if (m.contract; as c) {
            <dl class="facts">
              <div><dt>Início</dt><dd class="mono">{{ c.startsAt | date: 'dd/MM/yyyy' }}</dd></div>
              <div><dt>Fim</dt><dd class="mono">{{ c.endsAt ? (c.endsAt | date: 'dd/MM/yyyy') : 'sem prazo' }}</dd></div>
              <div><dt>Valor acordado</dt><dd class="mono">{{ c.priceCents !== null ? money(c.priceCents) : '—' }}</dd></div>
            </dl>
          }

          @if (draft(m.module); as dr) {
            @if (dr.open) {
              <div class="form">
                <div class="grid-2">
                  <label class="field">Vale até
                    <input type="date" [(ngModel)]="dr.until" [disabled]="dr.forever" [min]="tomorrow">
                  </label>
                  <label class="field">Valor acordado (R$, só registro)
                    <input type="number" min="0" step="0.01" [(ngModel)]="dr.price">
                  </label>
                </div>
                <div class="row quick">
                  <label class="check"><input type="checkbox" [(ngModel)]="dr.forever"> Sem prazo</label>
                  <span class="muted small">Atalhos:</span>
                  <button class="btn sm ghost" (click)="dr.forever = false; dr.until = plus(30)">+30 dias</button>
                  <button class="btn sm ghost" (click)="dr.forever = false; dr.until = plus(365)">+1 ano</button>
                </div>
                <label class="field">Anotação interna (a oficina não vê)
                  <input [(ngModel)]="dr.note" maxlength="2000" placeholder="ex.: contrato assinado em 28/11, pago via Pix">
                </label>
                <div class="row">
                  <button class="btn primary" (click)="activate(m)" [disabled]="busy() || (!dr.forever && !dr.until)">
                    {{ m.contract ? (m.access.active ? 'Salvar contrato' : 'Reativar contrato') : 'Ativar contrato' }}
                  </button>
                  <button class="btn ghost" (click)="dr.open = false">Cancelar</button>
                </div>
              </div>
            } @else {
              <div class="row actions">
                <button class="btn dark" (click)="dr.open = true">{{ m.contract ? 'Editar / reativar' : 'Contratar' }}</button>
                @if (m.contract?.status === 'ACTIVE') {
                  <input class="reason" [(ngModel)]="dr.reason" maxlength="300" placeholder="Motivo da suspensão (opcional)">
                  <button class="btn" (click)="suspend(m)" [disabled]="busy()">Suspender</button>
                }
                @if (m.contract?.status === 'SUSPENDED') {
                  <button class="btn" (click)="unsuspend(m)" [disabled]="busy()">Remover suspensão</button>
                }
                @if (m.contract && m.contract.status !== 'CANCELED') {
                  <button class="btn danger" (click)="cancel(m)" [disabled]="busy()">Encerrar contrato</button>
                }
              </div>
            }
          }

          @if (m.events.length) {
            <ol class="timeline">
              @for (e of m.events; track e.id) {
                <li>
                  <span class="mono when">{{ e.createdAt | date: 'dd/MM/yy HH:mm' }}</span>
                  <span>{{ eventLabel(e.type) }}</span>
                  <span class="muted small">{{ e.payload?.actor ?? '' }}</span>
                </li>
              }
            </ol>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .section { margin-top: 16px; }
    .section .card-pad p { margin: 4px 0 0; }
    .mod { border-top: 1px solid var(--line); display: grid; gap: 12px; }
    .mod-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .mod-head > div { display: flex; gap: 10px; align-items: center; }
    .facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0; }
    .facts dt { font-size: 12px; color: var(--muted); } .facts dd { margin: 0; }
    .form { display: grid; gap: 10px; padding: 12px; border-radius: var(--r); background: var(--bg); }
    .check { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
    .quick, .actions { flex-wrap: wrap; gap: 6px; }
    .reason { min-width: 220px; flex: 1; }
    .timeline { list-style: none; margin: 0; padding: 0; }
    .timeline li { display: grid; grid-template-columns: 120px 1fr auto; gap: 10px; padding: 5px 0; font-size: 13px; border-top: 1px dashed var(--line); }
    .timeline .when { color: var(--muted); }
    @media (max-width: 640px) { .facts { grid-template-columns: 1fr 1fr; } .timeline li { grid-template-columns: 1fr; } }
  `,
})
export class ModuleContractsCard implements OnInit {
  private readonly api = inject(Api);
  private readonly toast = inject(Toast);

  readonly enterpriseId = input.required<number>();
  readonly enterpriseName = input<string | null>(null);

  readonly modules = signal<ModuleContractView[]>([]);
  readonly busy = signal(false);
  private readonly drafts = new Map<string, Draft>();

  readonly money = money;
  readonly plus = plusDays;
  readonly tomorrow = plusDays(1);

  async ngOnInit() {
    try { this.set(await this.api.moduleContracts(this.enterpriseId())); } catch (err) { this.toast.error(err); }
  }

  private set(list: ModuleContractView[]) {
    this.modules.set(list);
    for (const m of list) {
      const c = m.contract;
      this.drafts.set(m.module, {
        until: toDateInput(c?.endsAt), forever: !!c && !c.endsAt, price: c?.priceCents != null ? c.priceCents / 100 : null,
        note: c?.adminNote ?? '', reason: '', open: false,
      });
    }
  }

  draft(module: string): Draft { return this.drafts.get(module)!; }

  statusLabel(m: ModuleContractView) {
    return { ACTIVE: 'Vencido / fora do prazo', SUSPENDED: 'Suspenso', CANCELED: 'Encerrado' }[m.contract!.status];
  }

  eventLabel(type: string) { return MODULE_EVENT_LABEL[type] ?? type; }

  private async run(op: () => Promise<unknown>, ok: string) {
    this.busy.set(true);
    try {
      await op();
      this.set(await this.api.moduleContracts(this.enterpriseId()));
      this.toast.show(ok);
    } catch (err) {
      this.toast.error(err);
    } finally {
      this.busy.set(false);
    }
  }

  activate(m: ModuleContractView) {
    const d = this.draft(m.module);
    return this.run(() => this.api.activateModule(this.enterpriseId(), m.module, {
      endsAt: d.forever ? null : endOfDayIso(d.until),
      priceCents: d.price === null || d.price === undefined || (d.price as unknown) === '' ? null : Math.round(Number(d.price) * 100),
      note: d.note,
      ...(this.enterpriseName() && { enterpriseName: this.enterpriseName()! }),
    }), `${m.name}: contrato ativo.`);
  }

  suspend(m: ModuleContractView) {
    if (!confirm(`Suspender ${m.name}? O módulo some da oficina na hora (os dados ficam guardados).`)) return;
    return this.run(() => this.api.suspendModule(this.enterpriseId(), m.module, this.draft(m.module).reason.trim()), `${m.name} suspenso.`);
  }

  unsuspend(m: ModuleContractView) {
    return this.run(() => this.api.unsuspendModule(this.enterpriseId(), m.module), 'Suspensão removida.');
  }

  cancel(m: ModuleContractView) {
    if (!confirm(`Encerrar o contrato de ${m.name}? O módulo some da oficina na hora. Os dados de estoque NÃO são apagados e voltam se reativar.`)) return;
    return this.run(() => this.api.cancelModule(this.enterpriseId(), m.module), 'Contrato encerrado.');
  }
}
