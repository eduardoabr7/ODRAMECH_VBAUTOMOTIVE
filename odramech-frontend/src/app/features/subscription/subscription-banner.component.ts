import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SubscriptionFacade } from './subscription.facade';
import { ConnectionService } from '@shared/services/connection.service';

/**
 * Aviso discreto no topo quando a assinatura pede atenção:
 * teste acabando (≤ 5 dias), pagamento pendente ou acesso bloqueado.
 */
@Component({
  selector: 'app-subscription-banner',
  standalone: true,
  imports: [RouterModule],
  template: `
    @if (message(); as m) {
      <div class="sub-banner {{ m.tone }}">
        <i [class]="m.icon"></i>
        <span>{{ m.text }}</span>
        <a routerLink="/settings/subscription">{{ m.cta }} <i class="fa-solid fa-arrow-right"></i></a>
      </div>
    }
  `,
  styles: [`
    .sub-banner {
      display: flex; align-items: center; gap: 10px; padding: 8px 28px; font-size: 13px;
      border-bottom: 1px solid var(--line); animation: fadeIn var(--dur-3) ease;
      i:first-child { font-size: 12px; }
      a { margin-left: auto; font-weight: 600; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; i { font-size: 10px; } }
    }
    .info { background: var(--info-soft); color: var(--info); }
    .warn { background: var(--warn-soft); color: var(--warn); }
    .bad { background: var(--danger-soft); color: var(--danger); }
    @media (max-width: 640px) { .sub-banner { padding: 8px 14px; } }
  `],
})
export class SubscriptionBannerComponent implements OnInit {
  private readonly facade = inject(SubscriptionFacade);

  constructor() {
    // ao reconectar com o backend, o status pode ter mudado
    inject(ConnectionService).reconnected$.pipe(takeUntilDestroyed()).subscribe(() => this.facade.refreshAccess());
  }

  readonly message = computed(() => {
    const a = this.facade.access();
    if (!a || a.degraded) return null;
    const days = this.facade.daysLeft();

    if (a.level === 'blocked') {
      return { tone: 'bad', icon: 'fa-solid fa-lock', text: `${a.reason.replace(/\.?\s*$/, '.')} O sistema está em modo somente leitura: sem cadastros, alterações, exportações ou impressões.`, cta: 'Regularizar' };
    }
    if (a.level === 'grace') {
      return { tone: 'warn', icon: 'fa-solid fa-triangle-exclamation', text: 'Pagamento da assinatura pendente.', cta: 'Pagar agora' };
    }
    if (a.status === 'TRIALING' && days !== null && days <= 5) {
      return { tone: 'info', icon: 'fa-regular fa-clock', text: `Seu teste grátis termina em ${days} dia(s).`, cta: 'Escolher plano' };
    }
    return null;
  });

  ngOnInit(): void {
    this.facade.refreshAccess();
  }
}
