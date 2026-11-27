import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ITEM_KIND_LABEL, ItemKind, lineTotal, ServiceItem, ServiceItemInput } from '@shared/models/Billing';

/**
 * Tabela de peças e serviços com inclusão inline.
 * Não chama API: emite eventos e o componente pai decide onde salvar (orçamento ou OS).
 */
@Component({
  selector: 'app-items-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="items">
    <table class="dtable items-table" *ngIf="items.length || editable">
      <thead>
        <tr>
          <th style="width:92px">Tipo</th>
          <th>Descrição</th>
          <th class="num" style="width:84px">Qtd.</th>
          <th class="num" style="width:120px">Unitário</th>
          <th class="num hide-sm" style="width:110px">Desconto</th>
          <th class="num" style="width:120px">Total</th>
          <th style="width:40px" *ngIf="editable"></th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let it of items; trackBy: trackById" class="item-row" [class.removing]="removingId === it.id">
          <td><span class="kind" [class.svc]="it.kind === 'SERVICO'">{{ KIND[it.kind] }}</span></td>
          <td class="desc">{{ it.description }}</td>
          <td class="num tnum">{{ it.quantity | number:'1.0-2' }}</td>
          <td class="num tnum">{{ it.unitPrice | currency:'BRL' }}</td>
          <td class="num tnum hide-sm" [class.faint]="!it.discount">{{ it.discount ? ('− ' + (it.discount | currency:'BRL')) : '—' }}</td>
          <td class="num tnum strong">{{ it.total | currency:'BRL' }}</td>
          <td *ngIf="editable" class="act">
            <button type="button" class="icon-btn" title="Remover" (click)="ask(it)"><i class="fa-regular fa-trash-can"></i></button>
          </td>
        </tr>

        <!-- inclusão rápida -->
        <tr class="add-row" *ngIf="editable">
          <td>
            <div class="kind-toggle">
              <button type="button" [class.on]="draft.kind === 'PECA'" (click)="draft.kind = 'PECA'" title="Peça">Peça</button>
              <button type="button" [class.on]="draft.kind === 'SERVICO'" (click)="draft.kind = 'SERVICO'" title="Serviço">Serv.</button>
            </div>
          </td>
          <td><input #descRef class="input sm" placeholder="Ex.: Pastilha de freio dianteira" [(ngModel)]="draft.description" (keydown.enter)="submit()"></td>
          <td><input class="input sm num" type="number" min="0.01" step="0.01" [(ngModel)]="draft.quantity" (keydown.enter)="submit()"></td>
          <td><input class="input sm num" type="number" min="0" step="0.01" placeholder="0,00" [(ngModel)]="draft.unitPrice" (keydown.enter)="submit()"></td>
          <td class="hide-sm"><input class="input sm num" type="number" min="0" step="0.01" placeholder="0,00" [(ngModel)]="draft.discount" (keydown.enter)="submit()"></td>
          <td class="num tnum faint">{{ draftTotal | currency:'BRL' }}</td>
          <td class="act">
            <button type="button" class="icon-btn add" [disabled]="!canSubmit || busy" (click)="submit()" title="Adicionar (Enter)">
              <span class="spinner-x" *ngIf="busy"></span><i class="fa-solid fa-plus" *ngIf="!busy"></i>
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="empty slim" *ngIf="!items.length && !editable">
      <p>Nenhuma peça ou serviço lançado.</p>
    </div>

    <div class="totals">
      <div class="t-row"><span>Peças</span><span class="tnum">{{ subtotal('PECA') | currency:'BRL' }}</span></div>
      <div class="t-row"><span>Serviços</span><span class="tnum">{{ subtotal('SERVICO') | currency:'BRL' }}</span></div>
      <div class="t-row grand"><span>Total</span><span class="tnum">{{ total | currency:'BRL' }}</span></div>
    </div>
  </div>
  `,
  styles: [`
    .items-table th.num, .items-table td.num { text-align: right; }
    .items-table td { padding-top: 10px; padding-bottom: 10px; }
    .desc { font-weight: 500; }
    .strong { font-weight: 600; }
    .kind { font-size: 11.5px; font-weight: 500; padding: 2px 7px; border-radius: 5px; background: var(--surface-3); color: var(--ink-2); }
    .kind.svc { background: var(--info-soft); color: var(--info); }
    .item-row { animation: rise var(--dur-3) var(--ease-out) both; transition: opacity var(--dur-2), transform var(--dur-2); }
    .item-row.removing { opacity: 0; transform: translateX(8px); }
    .add-row td { background: var(--surface-2); border-bottom: 0; }
    .input.sm { height: 32px; font-size: 13px; padding: 0 9px; }
    .input.num { text-align: right; }
    .kind-toggle { display: inline-flex; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; background: var(--surface); }
    .kind-toggle button { border: 0; background: transparent; font-size: 11.5px; padding: 0 7px; height: 28px; color: var(--muted); cursor: pointer; }
    .kind-toggle button.on { background: var(--ink); color: #fff; }
    .act { text-align: right; }
    .icon-btn { width: 30px; height: 30px; border-radius: 7px; border: 0; background: transparent; color: var(--muted); cursor: pointer; display: inline-grid; place-items: center; transition: background var(--dur-1), color var(--dur-1); }
    .icon-btn:hover:not([disabled]) { background: var(--danger-soft); color: var(--danger); }
    .icon-btn.add { background: var(--ink); color: #fff; }
    .icon-btn.add:hover:not([disabled]) { background: #000; color: #fff; }
    .icon-btn.add[disabled] { opacity: .35; }
    .icon-btn .spinner-x { width: 12px; height: 12px; }
    .totals { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; padding: 14px 20px 18px; border-top: 1px solid var(--line); }
    .t-row { display: flex; gap: 24px; font-size: 13px; color: var(--muted); min-width: 220px; justify-content: space-between; }
    .t-row.grand { color: var(--ink); font-size: 17px; font-weight: 600; letter-spacing: -0.02em; margin-top: 6px; padding-top: 8px; border-top: 1px dashed var(--line); }
    .empty.slim { padding: 22px; }
    .hide-sm { }
    @media (max-width: 640px) { .hide-sm { display: none; } }
  `],
})
export class ItemsEditorComponent {
  @Input() items: ServiceItem[] = [];
  @Input() editable = false;
  @Input() busy = false;

  @Output() add = new EventEmitter<ServiceItemInput>();
  @Output() remove = new EventEmitter<ServiceItem>();

  @ViewChild('descRef') descRef?: ElementRef<HTMLInputElement>;

  readonly KIND = ITEM_KIND_LABEL;
  removingId: number | null = null;

  draft: { kind: ItemKind; description: string; quantity: number; unitPrice: number | null; discount: number | null } = this.blank();

  private blank() {
    return { kind: 'PECA' as ItemKind, description: '', quantity: 1, unitPrice: null, discount: null };
  }

  get draftTotal(): number {
    return lineTotal({ quantity: this.draft.quantity, unitPrice: this.draft.unitPrice ?? 0, discount: this.draft.discount ?? 0 });
  }

  get canSubmit(): boolean {
    return !!this.draft.description.trim() && this.draft.quantity > 0 && (this.draft.unitPrice ?? -1) >= 0;
  }

  get total(): number {
    return Math.round(this.items.reduce((a, i) => a + i.total, 0) * 100) / 100;
  }

  subtotal(kind: ItemKind): number {
    return Math.round(this.items.filter(i => i.kind === kind).reduce((a, i) => a + i.total, 0) * 100) / 100;
  }

  submit(): void {
    if (!this.canSubmit || this.busy) return;
    this.add.emit({
      kind: this.draft.kind,
      description: this.draft.description.trim(),
      quantity: Number(this.draft.quantity),
      unitPrice: Number(this.draft.unitPrice ?? 0),
      discount: Number(this.draft.discount ?? 0),
    });
  }

  /** chamado pelo pai quando o item foi salvo */
  reset(): void {
    const kind = this.draft.kind;
    this.draft = { ...this.blank(), kind };
    setTimeout(() => this.descRef?.nativeElement.focus());
  }

  ask(it: ServiceItem): void {
    if (!confirm(`Remover "${it.description}"?`)) return;
    this.removingId = it.id;
    setTimeout(() => this.remove.emit(it), 180);
  }

  trackById(_: number, it: ServiceItem) { return it.id; }
}
