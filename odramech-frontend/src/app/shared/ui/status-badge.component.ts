import { Component, Input } from '@angular/core';
import { STATUS_LABEL, StatusOS } from '@shared/enums/status-os.enum';

@Component({
  selector: 'app-status',
  standalone: true,
  template: `<span class="status {{ status }}" [class.live]="status === 'EM_ATENDIMENTO'">{{ label }}</span>`,
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: StatusOS;
  get label(): string { return STATUS_LABEL[this.status] ?? this.status; }
}
