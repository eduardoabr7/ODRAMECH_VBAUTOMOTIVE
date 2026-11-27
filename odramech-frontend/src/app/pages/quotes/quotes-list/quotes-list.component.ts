import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { debounceTime, Subject, Subscription, switchMap, tap } from 'rxjs';
import { BillingService } from '@shared/services/billing.service';
import { SessionService } from '@shared/services/session.service';
import { Quote, QUOTE_STATUS_LABEL, QUOTE_STATUS_ORDER, QuoteStatus } from '@shared/models/Billing';
import { InitialsPipe, PlatePipe, RelativeTimePipe } from '@shared/ui/pipes';

@Component({
  selector: 'app-quotes-list',
  imports: [CommonModule, FormsModule, RouterModule, InitialsPipe, PlatePipe, RelativeTimePipe],
  templateUrl: './quotes-list.component.html',
  styleUrl: './quotes-list.component.scss',
})
export class QuotesListComponent implements OnInit, OnDestroy {
  readonly LABEL = QUOTE_STATUS_LABEL;
  readonly ORDER = QUOTE_STATUS_ORDER;

  quotes: Quote[] = [];
  all: Quote[] = [];
  status: QuoteStatus | null = null;
  search = '';
  loading = true;

  private readonly reload$ = new Subject<void>();
  private readonly subs = new Subscription();

  constructor(private readonly _billing: BillingService, private readonly _router: Router, readonly session: SessionService) {}

  ngOnInit(): void {
    this.subs.add(this.reload$.pipe(
      debounceTime(200),
      tap(() => this.loading = true),
      switchMap(() => this._billing.listQuotes(null, this.search)),
    ).subscribe({
      next: list => { this.all = list; this.applyFilter(); this.loading = false; },
      error: () => this.loading = false,
    }));
    this.reload$.next();
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  count(s: QuoteStatus): number { return this.all.filter(q => q.status === s).length; }

  setStatus(s: QuoteStatus | null): void { this.status = s; this.applyFilter(); }

  private applyFilter(): void {
    this.quotes = this.status ? this.all.filter(q => q.status === this.status) : this.all;
  }

  onSearch(): void { this.reload$.next(); }

  open(q: Quote): void { this._router.navigate(['/quotes', q.id]); }

  get pipelineValue(): number {
    return this.all.filter(q => q.status === 'ENVIADO' || q.status === 'RASCUNHO').reduce((a, q) => a + q.total, 0);
  }

  get approvedValue(): number {
    return this.all.filter(q => q.status === 'APROVADO').reduce((a, q) => a + q.total, 0);
  }

  get conversion(): number | null {
    const decided = this.all.filter(q => q.status === 'APROVADO' || q.status === 'RECUSADO');
    if (!decided.length) return null;
    return Math.round((decided.filter(q => q.status === 'APROVADO').length / decided.length) * 100);
  }
}
