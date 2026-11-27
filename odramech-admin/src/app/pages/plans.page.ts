import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Toast } from '../core/api.service';
import { money, Plan } from '../core/models';

/** recursos que o backend da oficina sabe conferir */
const KNOWN_FEATURES = [
  { code: 'QUOTE_DOCUMENT_EDITOR', label: 'Documento de orçamento personalizado' },
  { code: 'LOGIN_CUSTOMIZATION', label: 'Tela de login com a marca da oficina' },
];

interface Draft {
  name: string;
  price: string;
  description: string;
  maxEstablishments: string;
  features: string[];
  active: boolean;
}

@Component({
  selector: 'adm-plans',
  imports: [FormsModule],
  template: `
    <header class="head">
      <h1>Planos</h1>
      <p class="muted">Preço novo vale para as próximas faturas — as já emitidas não mudam. O plano do teste grátis não pode ser desativado.</p>
    </header>

    <div class="plans">
      @for (p of plans(); track p.id) {
        <section class="card card-pad plan" [class.off]="!drafts[p.id].active">
          <div class="row">
            <span class="code mono">{{ p.code }}</span>
            <span class="spacer"></span>
            <label class="check"><input type="checkbox" [(ngModel)]="drafts[p.id].active"> Ativo</label>
          </div>
          <label class="field">Nome <input [(ngModel)]="drafts[p.id].name" maxlength="60"></label>
          <div class="grid-2">
            <label class="field">Preço (R$/{{ p.interval === 'YEARLY' ? 'ano' : 'mês' }})
              <input inputmode="decimal" [(ngModel)]="drafts[p.id].price">
            </label>
            <label class="field">Estabelecimentos
              <input inputmode="numeric" [(ngModel)]="drafts[p.id].maxEstablishments" placeholder="sem limite">
            </label>
          </div>
          <label class="field">Descrição <textarea [(ngModel)]="drafts[p.id].description" maxlength="500" rows="2"></textarea></label>
          <div class="feats">
            @for (f of features; track f.code) {
              <label class="check"><input type="checkbox" [checked]="drafts[p.id].features.includes(f.code)" (change)="toggle(p.id, f.code)"> {{ f.label }}</label>
            }
          </div>
          <div class="row">
            <span class="muted small">Atual: {{ money(p.priceCents) }}</span>
            <span class="spacer"></span>
            <button class="btn dark" (click)="save(p)" [disabled]="busy() === p.id">{{ busy() === p.id ? 'Salvando…' : 'Salvar' }}</button>
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .head { margin-bottom: 18px; }
    .head p { margin: 4px 0 0; max-width: 680px; }
    .plans { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
    .plan { display: grid; gap: 12px; align-content: start; }
    .plan.off { opacity: .65; }
    .code { padding: 2px 8px; border-radius: 6px; background: var(--bg); font-weight: 500; }
    .check { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
    .feats { display: grid; gap: 6px; padding: 10px 12px; border-radius: var(--r); background: var(--bg); }
  `,
})
export class PlansPage implements OnInit {
  private readonly api = inject(Api);
  private readonly toast = inject(Toast);

  readonly plans = signal<Plan[]>([]);
  readonly busy = signal<number | null>(null);
  readonly features = KNOWN_FEATURES;
  readonly money = money;
  drafts: Record<number, Draft> = {};

  async ngOnInit() {
    try { this.setPlans(await this.api.plans()); } catch (err) { this.toast.error(err); }
  }

  private setPlans(plans: Plan[]) {
    this.drafts = Object.fromEntries(plans.map(p => [p.id, {
      name: p.name,
      price: (p.priceCents / 100).toFixed(2).replace('.', ','),
      description: p.description ?? '',
      maxEstablishments: p.maxEstablishments === null ? '' : String(p.maxEstablishments),
      features: [...p.features],
      active: p.active,
    }]));
    this.plans.set(plans);
  }

  toggle(id: number, code: string) {
    const f = this.drafts[id].features;
    this.drafts[id].features = f.includes(code) ? f.filter(x => x !== code) : [...f, code];
  }

  async save(p: Plan) {
    const d = this.drafts[p.id];
    const priceCents = Math.round(Number(d.price.replace(/\./g, '').replace(',', '.')) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) return this.toast.show('Preço inválido.', true);
    const max = d.maxEstablishments.trim() === '' ? null : Number(d.maxEstablishments);
    if (max !== null && (!Number.isInteger(max) || max < 1)) return this.toast.show('Limite de estabelecimentos inválido.', true);
    if (priceCents !== p.priceCents && !confirm(`Mudar o preço de ${money(p.priceCents)} para ${money(priceCents)}? Vale para as próximas faturas.`)) return;

    this.busy.set(p.id);
    try {
      await this.api.updatePlan(p.id, { name: d.name.trim(), priceCents, description: d.description.trim(), maxEstablishments: max, features: d.features, active: d.active });
      this.setPlans(await this.api.plans());
      this.toast.show('Plano salvo.');
    } catch (err) {
      this.toast.error(err);
    } finally {
      this.busy.set(null);
    }
  }
}
