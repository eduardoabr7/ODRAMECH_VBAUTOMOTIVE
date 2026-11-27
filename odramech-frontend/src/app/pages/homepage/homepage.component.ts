import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '@shared/services/auth.service';
import { SessionService } from '@shared/services/session.service';
import { WorkOrderService } from '@shared/services/work-orders.service';
import { AuthContext } from '@shared/models/AuthContext';
import { WorkOrderStats } from '@shared/models/WorkOrder';
import { STATUS_LABEL, StatusOS } from '@shared/enums/status-os.enum';
import { RecentServicesComponent } from '@shared/components/recent-services/recent-services.component';
import { UserRemindersComponent } from '@shared/components/user-reminders/user-reminders.component';
import { CountUpDirective } from '@shared/ui/count-up.directive';

@Component({
  selector: 'app-homepage',
  imports: [CommonModule, RouterModule, RecentServicesComponent, UserRemindersComponent, CountUpDirective],
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.scss'
})
export class HomepageComponent implements OnInit, OnDestroy {

  authContext: AuthContext | null = null;
  stats: WorkOrderStats | null = null;
  loading = true;
  error = false;
  today = new Date();

  readonly pipeline: StatusOS[] = [StatusOS.PENDENTE, StatusOS.EM_ATENDIMENTO, StatusOS.AGUARDANDO_PECAS, StatusOS.FINALIZADA];
  readonly STATUS_LABEL = STATUS_LABEL;

  private readonly subs = new Subscription();

  constructor(
    private readonly _authservice: AuthService,
    private readonly _workOrders: WorkOrderService,
    private readonly _router: Router,
    readonly session: SessionService,
  ){}

  ngOnInit() {
    this.subs.add(this._authservice.user$.subscribe(ctx => this.authContext = ctx));
    this.load();
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  load(): void {
    this.loading = true;
    this.error = false;
    this._workOrders.stats().subscribe({
      next: s => { this.stats = s; this.loading = false; },
      error: () => { this.loading = false; this.error = true; },
    });
  }

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  get firstName(): string {
    return this.authContext?.user?.name?.split(' ')[0] ?? '';
  }

  /** Total dos status do pipeline — usado para a barra proporcional */
  get pipelineTotal(): number {
    if (!this.stats) return 0;
    return this.pipeline.reduce((acc, s) => acc + (this.stats!.byStatus[s] ?? 0), 0);
  }

  share(status: StatusOS): number {
    const total = this.pipelineTotal;
    return total ? ((this.stats?.byStatus[status] ?? 0) / total) * 100 : 0;
  }

  goToStatus(status: StatusOS): void {
    this._router.navigate(['/orders'], { queryParams: { status } });
  }
}
