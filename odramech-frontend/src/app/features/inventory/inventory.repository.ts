import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiRepository } from '../../core/http/api-repository';
import { PartOption } from '@shared/models/Billing';
import { InventorySummary, MovementInput, Page, Part, PartDetail, PartInput, StockMovement } from './inventory.models';

/** função de busca que o editor de itens recebe (o editor continua sem conhecer a API) */
export function partSearchFn(repo: InventoryRepository) {
  return (term: string): Observable<PartOption[]> =>
    repo.list({ search: term, pageSize: 8 }).pipe(
      map(page => page.items.map(p => ({ id: p.id, name: p.name, code: p.code, brand: p.brand, unit: p.unit, quantity: p.quantity, salePrice: p.salePrice }))),
    );
}

/** REPOSITORY — endpoints do módulo Estoque (o backend exige o contrato em todos). */
@Injectable({ providedIn: 'root' })
export class InventoryRepository extends ApiRepository {
  protected readonly resource = 'inventory';

  list(q: { search?: string; lowStock?: boolean; includeInactive?: boolean; page?: number; pageSize?: number } = {}): Observable<Page<Part>> {
    return this.httpList(q, 'parts');
  }
  summary(): Observable<InventorySummary> { return this.httpGet('summary'); }
  get(id: number): Observable<PartDetail> { return this.httpGet('parts', id); }
  create(input: PartInput): Observable<PartDetail> { return this.httpPost(input, 'parts'); }
  update(id: number, input: Partial<PartInput>): Observable<PartDetail> { return this.httpPut(input, 'parts', id); }
  setActive(id: number, active: boolean): Observable<PartDetail> { return this.httpPut({ active }, 'parts', id, 'status'); }
  move(id: number, input: MovementInput): Observable<PartDetail> { return this.httpPost(input, 'parts', id, 'movements'); }
  movements(q: { partId?: number; page?: number; pageSize?: number } = {}): Observable<Page<StockMovement>> {
    return this.httpList(q, 'movements');
  }
}
