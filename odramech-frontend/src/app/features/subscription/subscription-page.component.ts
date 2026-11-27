import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { SubscriptionFacade } from './subscription.facade';
import { Invoice, PaymentMethod, Plan, PLAN_FEATURE_LABEL, STATUS_LABEL } from './subscription.models';
import { PAYMENT_LIST, PAYMENT_UI } from './payment-method.strategies';

@Component({
  selector: 'app-subscription-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './subscription-page.component.html',
  styleUrl: './subscription-page.component.scss',
})
export class SubscriptionPageComponent implements OnInit {
  readonly facade = inject(SubscriptionFacade);
  private readonly toastr = inject(ToastrService);

  readonly STATUS_LABEL = STATUS_LABEL;
  readonly PAYMENT_UI = PAYMENT_UI;
  readonly PAYMENT_LIST = PAYMENT_LIST;
  readonly FEATURE_LABEL = PLAN_FEATURE_LABEL;

  readonly chosenPlan = signal<string | null>(null);
  readonly chosenMethod = signal<PaymentMethod>('PIX');
  cardToken = 'tok_aprovado';

  readonly o = this.facade.overview;

  readonly selectedPlan = computed(() => {
    const o = this.o();
    const code = this.chosenPlan() ?? o?.plan?.code;
    return o?.plans.find(p => p.code === code) ?? null;
  });

  readonly invoice = computed(() => this.o()?.openInvoice ?? null);

  /** já existe fatura aberta exatamente do plano/forma escolhidos? */
  readonly needsNewInvoice = computed(() => {
    const inv = this.invoice();
    const plan = this.selectedPlan();
    return !inv || !plan || inv.planCode !== plan.code || (inv.method !== null && inv.method !== this.chosenMethod());
  });

  constructor() {
    // ao carregar, a forma de pagamento escolhida passa a ser a da fatura/assinatura existente
    effect(() => {
      const o = this.o();
      const method = o?.openInvoice?.method ?? o?.subscription.paymentMethod;
      if (method) untracked(() => this.chosenMethod.set(method));
    });
  }

  ngOnInit(): void {
    this.facade.load();
  }

  money(cents: number | null | undefined): string {
    return ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  pickPlan(p: Plan) { if (this.fits(p)) this.chosenPlan.set(p.code); }

  /** a empresa cabe no plano? (não dá para escolher um plano menor que o número de estabelecimentos) */
  fits(p: Plan): boolean {
    const count = this.o()?.establishmentCount ?? 0;
    return p.maxEstablishments === null || count <= p.maxEstablishments;
  }

  establishmentsLabel(p: Plan): string {
    if (p.maxEstablishments === null) return '10+ estabelecimentos';
    return p.maxEstablishments === 1 ? '1 estabelecimento' : `Até ${p.maxEstablishments} estabelecimentos`;
  }

  planName(code: string): string {
    return this.o()?.plans.find(p => p.code === code)?.name ?? code;
  }

  /** texto de quando a troca passa a valer */
  readonly changeHint = computed(() => {
    const o = this.o();
    const next = this.selectedPlan();
    if (!o || !next || next.code === o.plan.code) return null;
    if (o.subscription.status === 'TRIALING') return 'A troca vale agora; a cobrança começa só no fim do teste grátis.';
    if (o.subscription.status !== 'ACTIVE') return 'O plano novo começa assim que o pagamento for confirmado.';
    return next.tier > o.plan.tier
      ? 'Upgrade: começa assim que o pagamento for confirmado. O que sobrou do período atual vira desconto.'
      : 'Downgrade: vale a partir da próxima renovação; até lá você segue no plano atual.';
  });

  subscribe() {
    const plan = this.selectedPlan();
    if (plan) this.facade.selectPlan(plan.code, this.chosenMethod());
  }

  pay(inv: Invoice) {
    const ui = PAYMENT_UI[this.chosenMethod()];
    this.facade.pay(inv.id, ui.method, ui.needsCardToken ? this.cardToken : undefined);
  }

  async copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.toastr.success('Copiado para a área de transferência.');
    } catch {
      this.toastr.info('Selecione e copie o código manualmente.');
    }
  }

  cancel() {
    if (confirm('Cancelar a assinatura? Você continua com acesso até o fim do período atual.')) this.facade.cancel();
  }
}
