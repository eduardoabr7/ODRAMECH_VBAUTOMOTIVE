import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, Subject, switchMap, tap } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { SessionService } from '@shared/services/session.service';
import { BodyPortalDirective } from '@shared/directives/body-portal.directive';
import { InventoryRepository } from './inventory.repository';
import {
  InventorySummary, ManualMovement, MOVEMENT_LABEL, Part, PART_UNITS, PartDetail, PartInput, PartUnit, UNIT_LABEL,
} from './inventory.models';

type Filter = 'all' | 'low';
type Drawer = { mode: 'detail'; part: PartDetail } | { mode: 'form'; part: PartDetail | null } | null;

interface PartForm {
  code: string; name: string; brand: string; oemCode: string; unit: PartUnit;
  costPrice: number | null; salePrice: number | null; minQuantity: number | null;
  location: string; notes: string; initialQuantity: number | null;
}

/** Tela do módulo Estoque: lista de peças, indicadores, cadastro e movimentações. */
@Component({
  selector: 'app-inventory-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BodyPortalDirective],
  templateUrl: './inventory-page.component.html',
  styleUrl: './inventory-page.component.scss',
})
export class InventoryPageComponent implements OnInit {
  private readonly repo = inject(InventoryRepository);
  private readonly toastr = inject(ToastrService);
  private readonly destroyRef = inject(DestroyRef);
  readonly isManager = toSignal(inject(SessionService).isManager$, { initialValue: false });

  readonly UNITS = PART_UNITS;
  readonly UNIT = UNIT_LABEL;
  readonly MOVE = MOVEMENT_LABEL;

  readonly parts = signal<Part[]>([]);
  readonly total = signal(0);
  readonly summary = signal<InventorySummary | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly drawer = signal<Drawer>(null);

  search = '';
  filter: Filter = 'all';
  includeInactive = false;
  private page = 1;
  private readonly pageSize = 30;
  private readonly query$ = new Subject<string>();

  form: PartForm = this.blankForm();
  move: { type: ManualMovement; quantity: number | null; unitCost: number | null; note: string } | null = null;

  readonly hasMore = computed(() => this.parts().length < this.total());

  ngOnInit(): void {
    this.query$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      tap(() => { this.loading.set(true); this.page = 1; }),
      switchMap(() => this.repo.list(this.params())),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: r => { this.parts.set(r.items); this.total.set(r.total); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.reload();
  }

  // ── Lista ────────────────────────────────────────────────
  private params() {
    return {
      search: this.search.trim() || undefined,
      lowStock: this.filter === 'low' || undefined,
      includeInactive: this.includeInactive || undefined,
      page: this.page,
      pageSize: this.pageSize,
    };
  }

  /** muda a "chave" da consulta para forçar recarga mesmo com o mesmo texto */
  reload(): void {
    this.query$.next(`${this.search}|${this.filter}|${this.includeInactive}|${Date.now()}`);
    this.repo.summary().subscribe({ next: s => this.summary.set(s), error: () => this.summary.set(null) });
  }

  onSearch(): void { this.query$.next(`${this.search}|${this.filter}|${this.includeInactive}`); }

  setFilter(f: Filter): void { this.filter = f; this.onSearch(); }

  loadMore(): void {
    this.page++;
    this.repo.list(this.params()).subscribe(r => { this.parts.update(list => [...list, ...r.items]); this.total.set(r.total); });
  }

  // ── Detalhe ──────────────────────────────────────────────
  open(p: Part): void {
    this.move = null;
    this.repo.get(p.id).subscribe({
      next: part => this.drawer.set({ mode: 'detail', part }),
      error: err => this.toastr.error(err?.error?.message ?? 'Não foi possível abrir a peça.'),
    });
  }

  close(): void { this.drawer.set(null); this.move = null; }

  private showDetail(part: PartDetail): void {
    this.drawer.set({ mode: 'detail', part });
    this.parts.update(list => list.map(p => (p.id === part.id ? part : p)));
  }

  // ── Movimentação ─────────────────────────────────────────
  startMove(type: ManualMovement): void {
    this.move = { type, quantity: null, unitCost: null, note: '' };
  }

  submitMove(part: PartDetail): void {
    const m = this.move;
    if (!m || m.quantity === null || m.quantity < 0 || this.busy()) return;
    this.busy.set(true);
    this.repo.move(part.id, {
      type: m.type,
      quantity: Number(m.quantity),
      ...(m.type === 'ENTRADA' && m.unitCost !== null && { unitCost: Number(m.unitCost) }),
      ...(m.note.trim() && { note: m.note.trim() }),
    }).subscribe({
      next: updated => {
        this.busy.set(false);
        this.move = null;
        this.showDetail(updated);
        this.repo.summary().subscribe(s => this.summary.set(s));
        this.toastr.success('Movimentação registrada.');
      },
      error: err => { this.busy.set(false); this.toastr.error(err?.error?.message ?? 'Não foi possível registrar.'); },
    });
  }

  // ── Cadastro ─────────────────────────────────────────────
  private blankForm(): PartForm {
    return { code: '', name: '', brand: '', oemCode: '', unit: 'UN', costPrice: null, salePrice: null, minQuantity: null, location: '', notes: '', initialQuantity: null };
  }

  newPart(): void {
    this.form = this.blankForm();
    this.drawer.set({ mode: 'form', part: null });
  }

  edit(part: PartDetail): void {
    this.form = {
      code: part.code ?? '', name: part.name, brand: part.brand ?? '', oemCode: part.oemCode ?? '', unit: part.unit,
      costPrice: part.costPrice, salePrice: part.salePrice, minQuantity: part.minQuantity,
      location: part.location ?? '', notes: part.notes ?? '', initialQuantity: null,
    };
    this.drawer.set({ mode: 'form', part });
  }

  get formValid(): boolean { return this.form.name.trim().length >= 2; }

  save(): void {
    const d = this.drawer();
    if (d?.mode !== 'form' || !this.formValid || this.busy()) return;
    const f = this.form;
    const input: PartInput = {
      code: f.code.trim(), name: f.name.trim(), brand: f.brand.trim(), oemCode: f.oemCode.trim(), unit: f.unit,
      costPrice: Number(f.costPrice ?? 0), salePrice: Number(f.salePrice ?? 0), minQuantity: Number(f.minQuantity ?? 0),
      location: f.location.trim(), notes: f.notes.trim(),
    };
    const op = d.part
      ? this.repo.update(d.part.id, input)
      : this.repo.create({ ...input, ...(f.initialQuantity ? { initialQuantity: Number(f.initialQuantity) } : {}) });
    this.busy.set(true);
    op.subscribe({
      next: part => {
        this.busy.set(false);
        this.toastr.success(d.part ? 'Peça atualizada.' : 'Peça cadastrada.');
        this.drawer.set({ mode: 'detail', part });
        this.reload();
      },
      error: err => { this.busy.set(false); this.toastr.error(errorMessage(err, 'Não foi possível salvar a peça.')); },
    });
  }

  toggleActive(part: PartDetail): void {
    if (part.active && !confirm(`Desativar "${part.name}"? Ela some das buscas, mas o histórico fica.`)) return;
    this.repo.setActive(part.id, !part.active).subscribe({
      next: p => { this.showDetail(p); this.reload(); },
      error: err => this.toastr.error(err?.error?.message ?? 'Não foi possível alterar.'),
    });
  }

  trackById(_: number, p: { id: number }) { return p.id; }
}

/** class-validator devolve uma lista de mensagens; o resto, uma só */
function errorMessage(err: any, fallback: string): string {
  const m = err?.error?.message;
  return Array.isArray(m) ? m[0] : m ?? fallback;
}
