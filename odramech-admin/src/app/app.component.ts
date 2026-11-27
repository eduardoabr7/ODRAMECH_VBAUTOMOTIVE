import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from './core/api.service';

@Component({
  selector: 'adm-root',
  imports: [RouterOutlet],
  template: `
    <router-outlet />
    @if (toast.current(); as t) {
      <div class="toast" [class.error]="t.error" role="status">{{ t.text }}</div>
    }
  `,
})
export class AppComponent {
  readonly toast = inject(Toast);
}
