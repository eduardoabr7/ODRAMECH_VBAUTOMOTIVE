import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { SubscriptionFacade } from './subscription.facade';
import { Invoice, PaymentMethod, Plan, STATUS_LABEL } from './subscription.models';
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

  pickPlan(p: Plan) { this.chosenPlan.set(p.code); }

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
