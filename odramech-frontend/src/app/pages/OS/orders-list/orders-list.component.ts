import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, Subscription, switchMap, tap } from 'rxjs';
import { WorkOrderService } from '@shared/services/work-orders.service';
import { SessionService } from '@shared/services/session.service';
import { WorkOrder, WorkOrderPage } from '@shared/models/WorkOrder';
import { STATUS_LABEL, STATUS_ORDER, StatusOS } from '@shared/enums/status-os.enum';
import { StatusBadgeComponent } from '@shared/ui/status-badge.component';
import { ExportButtonComponent, ExportOption } from '../../../features/export/export-button.component';
import { InitialsPipe, PlatePipe, RelativeTimePipe } from '@shared/ui/pipes';

@Component({
  selector: 'app-orders-list',
  imports: [CommonModule, FormsModule, RouterModule, StatusBadgeComponent, InitialsPipe, PlatePipe, RelativeTimePipe, ExportButtonComponent],
  templateUrl: './orders-list.component.html',
  styleUrl: './orders-list.component.scss',
})
export class OrdersListComponent implements OnInit, OnDestroy {

  readonly STATUS_ORDER = STATUS_ORDER;
  readonly STATUS_LABEL = STATUS_LABEL;
  readonly Math = Math;

  status: StatusOS | null = null;
  search = '';
  page = 1;
  readonly pageSize = 20;

  data: WorkOrderPage | null = null;
  loading = true;

  /** planilha sai com os filtros da tela (status e busca) */
  readonly exportOrders: ExportOption = {
    kind: 'work-orders', label: 'Ordens de serviço', hint: 'Com os filtros atuais, peças e serviços',
    filters: () => ({ status: this.status, search: this.search }),
  };
  readonly exportPayments: ExportOption = { kind: 'payments', label: 'Financeiro (pagamentos)', hint: 'Todos os pagamentos e resumo por forma' };

  private readonly reload$ = new Subject<void>();
  private readonly search$ = new Subject<string>();
  private readonly subs = new Subscription();

  constructor(
    private readonly _workOrders: WorkOrderService,
    private readonly _route: ActivatedRoute,
    private readonly _router: Router,
    readonly session: SessionService,
  ) {}

  ngOnInit(): void {
    const qp = this._route.snapshot.queryParamMap;
    this.status = (qp.get('status') as StatusOS) || null;
    this.search = qp.get('search') ?? '';

    // a busca global do topo navega para cá com ?search=
    this.subs.add(this._route.queryParamMap.subscribe(map => {
      const s = map.get('search') ?? '';
      const st = (map.get('status') as StatusOS) || null;
      if (s !== this.search || st !== this.status) {
        this.search = s;
        this.status = st;
        this.page = 1;
        this.reload$.next();
      }
    }));

    this.subs.add(this.search$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.page = 1;
      this.syncUrl();
      this.reload$.next();
    }));

    this.subs.add(this.reload$.pipe(
      tap(() => this.loading = true),
      switchMap(() => this._workOrders.list({
        status: this.status,
        search: this.search,
        page: this.page,
        pageSize: this.pageSize,
      })),
    ).subscribe({
      next: data => { this.data = data; this.loading = false; },
      error: () => { this.loading = false; },
    }));

    this.reload$.next();
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  get totalAll(): number {
    if (!this.data) return 0;
    return Object.values(this.data.countsByStatus).reduce((a, b) => a + b, 0);
  }

  get pages(): number {
    return this.data ? Math.max(1, Math.ceil(this.data.total / this.pageSize)) : 1;
  }

  setStatus(status: StatusOS | null): void {
    if (this.status === status) return;
    this.status = status;
    this.page = 1;
    this.syncUrl();
    this.reload$.next();
  }

  onSearch(value: string): void { this.search$.next(value); }

  clearSearch(): void {
    this.search = '';
    this.search$.next('');
  }

  goPage(p: number): void {
    if (p < 1 || p > this.pages) return;
    this.page = p;
    this.reload$.next();
  }

  open(wo: WorkOrder): void {
    this._router.navigate(['/orders', wo.id]);
  }

  private syncUrl(): void {
    this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { status: this.status || null, search: this.search || null },
      replaceUrl: true,
    });
  }

  trackById(_: number, wo: WorkOrder) { return wo.id; }
}
