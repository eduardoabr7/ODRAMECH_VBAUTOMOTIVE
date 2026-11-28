import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DOCUMENT } from '@angular/common';
import { catchError, fromEvent, map, Observable, of, tap, throttleTime } from 'rxjs';
import { ApiRepository } from '../../core/http/api-repository';
import { AuthService } from '@shared/services/auth.service';

export type ContractedModule = 'INVENTORY';

export const MODULE_LABEL: Record<ContractedModule, string> = { INVENTORY: 'Estoque de peças' };
/** rota de cada módulo — ao perder o contrato, quem está nela volta para o início */
export const MODULE_ROUTE: Record<ContractedModule, string> = { INVENTORY: '/inventory' };

export interface ModuleStatus {
  module: ContractedModule;
  active: boolean;
  until: string | null;
}

@Injectable({ providedIn: 'root' })
class ContractedModulesRepository extends ApiRepository {
  protected readonly resource = 'modules';
  list(): Observable<{ modules: ModuleStatus[] }> { return this.httpGet(); }
}

/**
 * Módulos vendidos à parte (ex.: Estoque) que a empresa da sessão contratou.
 *
 * Só serve para MOSTRAR/ESCONDER telas: quem garante o acesso é o backend
 * (ModuleAccessGuard → 403). Fica atualizado quando:
 *  - troca o usuário/estabelecimento;
 *  - a aba volta a ficar visível (o contrato pode ter mudado no painel);
 *  - se entra na rota do módulo (o guard pergunta de novo);
 *  - alguma chamada recebe 403 MODULE_REQUIRED (interceptor → markInactive).
 */
@Injectable({ providedIn: 'root' })
export class ContractedModulesService {
  private readonly repo = inject(ContractedModulesRepository);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);

  private readonly modules = signal<ModuleStatus[]>([]);
  private signedIn = false;

  readonly inventory = computed(() => this.has('INVENTORY'));

  constructor() {
    const destroy = inject(DestroyRef);
    this.auth.user$.pipe(takeUntilDestroyed(destroy)).subscribe(ctx => {
      this.signedIn = !!ctx?.usercorp?.establishment;
      if (this.signedIn) this.refresh();
      else this.modules.set([]);
    });

    // voltou para a aba: confere de novo (no máximo 1x a cada 15 s)
    if (this.document?.defaultView) {
      fromEvent(this.document, 'visibilitychange').pipe(
        throttleTime(15_000),
        takeUntilDestroyed(destroy),
      ).subscribe(() => {
        if (this.document.visibilityState === 'visible' && this.signedIn) this.refresh();
      });
    }
  }

  has(module: ContractedModule): boolean {
    return this.modules().some(m => m.module === module && m.active);
  }

  refresh(): void {
    this.fetch().subscribe();
  }

  /** o backend acabou de recusar o módulo: esconde na hora, sem esperar outra consulta */
  markInactive(module: ContractedModule): void {
    this.modules.update(list => list.map(m => (m.module === module ? { ...m, active: false } : m)));
  }

  /** consulta agora (sem cache) e responde se o módulo está ativo — usado pelo guard da rota */
  check(module: ContractedModule): Observable<boolean> {
    return this.fetch().pipe(map(() => this.has(module)));
  }

  private fetch(): Observable<unknown> {
    return this.repo.list().pipe(
      tap(r => this.modules.set(r.modules ?? [])),
      // sem resposta: esconde (o backend recusaria de qualquer forma)
      catchError(() => { this.modules.set([]); return of(null); }),
    );
  }
}
