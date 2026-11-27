import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { WorkOrder } from '@shared/models/WorkOrder';
import { StatusBadgeComponent } from '@shared/ui/status-badge.component';
import { PlatePipe, RelativeTimePipe } from '@shared/ui/pipes';

@Component({
  selector: 'app-recent-services',
  imports: [CommonModule, RouterModule, StatusBadgeComponent, PlatePipe, RelativeTimePipe],
  templateUrl: './recent-services.component.html',
  styleUrl: './recent-services.component.scss'
})
export class RecentServicesComponent {
  @Input() orders: WorkOrder[] = [];
  @Input() loading = false;
}
