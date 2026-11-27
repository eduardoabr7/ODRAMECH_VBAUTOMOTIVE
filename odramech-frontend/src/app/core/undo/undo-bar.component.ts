import { Component, HostListener, inject } from '@angular/core';
import { UndoService } from './undo.service';

/** Barra "Ação feita · Desfazer" (estilo Gmail). Atalho: Ctrl+Z quando visível. */
@Component({
  selector: 'app-undo-bar',
  standalone: true,
  template: `
    @if (undo.current(); as cmd) {
      <div class="undo-bar" role="status" aria-live="polite">
        <span class="txt">{{ cmd.label }}</span>
        <button type="button" class="act" (click)="undo.run()" [disabled]="undo.busy()">
          @if (undo.busy()) { <span class="spin"></span> } @else { Desfazer <kbd>Ctrl Z</kbd> }
        </button>
        <button type="button" class="x" (click)="undo.dismiss()" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
        <span class="timer"></span>
      </div>
    }
  `,
  styles: [`
    .undo-bar {
      position: fixed; left: 50%; bottom: 24px; z-index: 1990; transform: translateX(-50%);
      display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 16px;
      background: var(--ink); color: #fff; border: 1px solid #2a2a2a; border-radius: 12px;
      box-shadow: var(--shadow-3); font-size: 13px; overflow: hidden;
      animation: up 360ms var(--ease-out) both;
    }
    .txt { max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .act {
      height: 30px; padding: 0 10px; border: 0; border-radius: 7px; background: transparent;
      color: #ffb38f; font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
    }
    .act:hover { background: #1f1f1f; }
    .act kbd { background: #222; border-color: #333; color: #8d8b85; }
    .x { width: 28px; height: 28px; border: 0; border-radius: 7px; background: transparent; color: #8d8b85; cursor: pointer; }
    .x:hover { background: #1f1f1f; color: #fff; }
    .spin { width: 13px; height: 13px; border-radius: 50%; border: 2px solid #ffb38f; border-right-color: transparent; animation: spin .7s linear infinite; }
    .timer { position: absolute; left: 0; bottom: 0; height: 2px; background: var(--accent); width: 100%; transform-origin: left; animation: drain 8s linear forwards; }
    @keyframes up { from { opacity: 0; transform: translate(-50%, 14px); } to { opacity: 1; transform: translate(-50%, 0); } }
    @keyframes drain { to { transform: scaleX(0); } }
  `],
})
export class UndoBarComponent {
  readonly undo = inject(UndoService);

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    const typing = target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
    if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && this.undo.current()) {
      e.preventDefault();
      this.undo.run();
    }
  }
}
