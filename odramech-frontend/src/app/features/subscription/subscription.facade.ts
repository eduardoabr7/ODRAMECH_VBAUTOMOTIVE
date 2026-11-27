import { computed, Injectable, signal } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { SubscriptionRepository } from './subscription.repository';
import { AccessDecision, PaymentMethod, SubscriptionOverview } from './subscription.models';

/**
 * FACADE — a tela de assinatura e o aviso do layout falam só com esta classe.
 * Ela concentra estado (signals), chamadas ao repositório, mensagens e tratamento de erro.
 * Componentes ficam só com apresentação (Single Responsibility).
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionFacade {
  readonly overview = signal<SubscriptionOverview | null>(null);
  readonly access = signal<AccessDecision | null>(null);
  readonly loading = signal(false);
  readonly busy = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly daysLeft = computed(() => {
    const until = this.overview()?.subscription.currentPeriodEnd ?? this.access()?.until;
    if (!until) return null;
    return Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 86_400_000));
  });

  constructor(private readonly repo: SubscriptionRepository, private readonly toastr: ToastrService) {}

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.repo.overview().subscribe({
      next: o => { this.setOverview(o); this.loading.set(false); },
      error: err => { this.loading.set(false); this.error.set(err?.error?.message ?? 'Não foi possível carregar a assinatura.'); },
    });
  }

  /** leve: só a decisão de acesso (para o aviso no topo) */
  refreshAccess(): void {
    this.repo.access().subscribe({ next: a => this.access.set(a), error: () => this.access.set(null) });
  }

  selectPlan(planCode: string, method: PaymentMethod) {
    this.run('plan', this.repo.selectPlan(planCode, method), 'Plano selecionado. A fatura foi gerada.');
  }

  pay(invoiceId: string, method: PaymentMethod, cardToken?: string) {
    const msg = method === 'CARD' ? 'Pagamento aprovado.' : 'Cobrança gerada. Pague para confirmar.';
    this.run('pay', this.repo.pay(invoiceId, method, cardToken), msg);
  }

  simulate(invoiceId: string) {
    this.run('simulate', this.repo.simulate(invoiceId), 'Pagamento confirmado (sandbox).');
  }

  cancel() {
    this.run('cancel', this.repo.cancel(), 'Cancelamento agendado para o fim do período.');
  }

  resume() {
    this.run('resume', this.repo.resume(), 'Assinatura reativada.');
  }

  private run(key: string, op: Observable<SubscriptionOverview>, success: string) {
    this.busy.set(key);
    op.subscribe({
      next: o => {
        this.busy.set(null);
        this.setOverview(o);
        this.toastr.success(success);
      },
      error: err => {
        this.busy.set(null);
        this.toastr.error(err?.error?.message ?? 'Não foi possível concluir a operação.');
      },
    });
  }

  private setOverview(o: SubscriptionOverview) {
    // o backend devolve overview (+ invoice no pagamento); mantém o access em sincronia
    this.overview.update(prev => ({ ...prev, ...o }) as SubscriptionOverview);
    if (o.access) this.access.set(o.access);
  }
}
