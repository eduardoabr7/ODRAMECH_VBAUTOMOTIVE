import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ToastrService } from 'ngx-toastr';
import { SessionService } from '@shared/services/session.service';
import { SettingsService } from '@shared/services/settings.service';

/** Configurações → Ordens de serviço: o que o cliente pode fazer na OS (por estabelecimento). */
@Component({
  selector: 'app-work-order-settings',
  standalone: true,
  imports: [FormsModule, RouterModule],
  template: `
    <div class="page">
      <a class="back reveal" routerLink="/settings"><i class="fa-solid fa-arrow-left"></i> Configurações</a>

      <div class="page-head">
        <div>
          <div class="eyebrow reveal">Estabelecimento</div>
          <h1 class="page-title reveal" style="--i:1">Ordens de serviço</h1>
          <p class="page-sub reveal" style="--i:2">Como o cliente participa do histórico da OS. Vale só para este estabelecimento.</p>
        </div>
      </div>

      @if (!isManager()) {
        <div class="panel note reveal"><i class="fa-solid fa-lock"></i> Só administradores alteram estas configurações.</div>
      }

      @if (loading()) {
        <div class="panel sk"></div>
      } @else {
        <section class="panel reveal" style="--i:3">
          <div class="panel-body">
            <label class="toggle-row" [class.ro]="!isManager()">
              <span class="switch">
                <input type="checkbox" [disabled]="!isManager() || saving()" [ngModel]="clientAppointments()" (ngModelChange)="toggle($event)">
                <span></span>
              </span>
              <span>
                <b>Cliente pode escrever na OS</b>
                <small>O cliente registra mensagens e fotos no histórico da própria OS. Ele só cria <b>apontamentos públicos</b> — as notas internas da equipe continuam invisíveis para ele.</small>
              </span>
            </label>

            <ul class="facts">
              <li><i class="fa-regular fa-eye"></i> A equipe sempre vê o que o cliente escreve, junto com os apontamentos públicos.</li>
              <li><i class="fa-solid fa-camera"></i> Com a opção ligada, o cliente também anexa fotos da câmera ou da galeria (até 10 MB cada).</li>
              <li><i class="fa-solid fa-lock"></i> Desligada: o cliente só acompanha o andamento, sem escrever.</li>
            </ul>
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .back { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); margin-bottom: 18px; &:hover { color: var(--ink); } i { font-size: 11px; } }
    .page { max-width: 860px; }
    .note { padding: 12px 16px; font-size: 13px; color: var(--muted); margin-bottom: 14px; i { margin-right: 6px; } }
    .sk { height: 180px; }
    .toggle-row { display: flex; gap: 12px; align-items: flex-start; cursor: pointer;
      &.ro { cursor: default; }
      b { font-size: 14px; } > span:last-child > b:first-child { display: block; }
      small { display: block; font-size: 12.5px; color: var(--muted); margin-top: 2px; line-height: 1.5; b { font-size: inherit; color: var(--ink-2); } }
      .switch { margin-top: 2px; flex-shrink: 0; } }
    .facts { list-style: none; margin: 18px 0 0; padding: 16px 0 0; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 10px;
      li { display: flex; gap: 10px; font-size: 13px; color: var(--ink-2); line-height: 1.45; }
      i { width: 16px; text-align: center; color: var(--muted); margin-top: 2px; } }
  `],
})
export class WorkOrderSettingsComponent implements OnInit {
  private readonly settings = inject(SettingsService);
  private readonly toastr = inject(ToastrService);
  readonly isManager = toSignal(inject(SessionService).isManager$, { initialValue: false });

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly clientAppointments = signal(false);

  ngOnInit(): void {
    this.settings.getWorkOrderSettings().subscribe({
      next: s => { this.clientAppointments.set(s.clientAppointmentsEnabled); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toastr.warning('Não foi possível carregar as configurações.'); },
    });
  }

  /** salva na hora: é um único interruptor */
  toggle(value: boolean): void {
    const previous = this.clientAppointments();
    this.clientAppointments.set(value);
    this.saving.set(true);
    this.settings.saveWorkOrderSettings({ clientAppointmentsEnabled: value }).subscribe({
      next: s => {
        this.clientAppointments.set(s.clientAppointmentsEnabled);
        this.saving.set(false);
        this.toastr.success(s.clientAppointmentsEnabled ? 'Clientes agora podem escrever nas OS.' : 'Clientes não escrevem mais nas OS.');
      },
      error: err => {
        this.clientAppointments.set(previous);
        this.saving.set(false);
        this.toastr.error(err?.error?.message ?? 'Não foi possível salvar.');
      },
    });
  }
}
