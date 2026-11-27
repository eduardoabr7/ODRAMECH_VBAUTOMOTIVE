import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { NestAPI } from '@shared/services/nest-api.service';
import { QueryParams } from './query-params.builder';

/**
 * REPOSITORY (base) — acesso HTTP a um recurso da API.
 *
 * Os serviços de dados herdam daqui e só declaram as operações do recurso;
 * URL base, credenciais e montagem de query ficam num lugar só.
 * Componentes dependem dos repositórios, nunca do HttpClient diretamente.
 */
export abstract class ApiRepository {
  protected readonly api = inject(NestAPI);

  /** caminho do recurso, ex.: 'workorder' */
  protected abstract readonly resource: string;

  protected path(...parts: (string | number)[]): string {
    return [this.resource, ...parts.map(p => encodeURIComponent(String(p)))].join('/');
  }

  protected httpList<T>(query?: Record<string, string | number | boolean | null | undefined>, ...parts: (string | number)[]): Observable<T> {
    const url = QueryParams.create().setAll(query ?? {}).appendTo(this.path(...parts));
    return this.api.get<T>(url);
  }

  protected httpGet<T>(...parts: (string | number)[]): Observable<T> {
    return this.api.get<T>(this.path(...parts));
  }

  protected httpPost<T>(body: unknown, ...parts: (string | number)[]): Observable<T> {
    return this.api.post<T>(this.path(...parts), body ?? {});
  }

  protected httpPut<T>(body: unknown, ...parts: (string | number)[]): Observable<T> {
    return this.api.put<T>(this.path(...parts), body);
  }

  protected httpDelete<T>(...parts: (string | number)[]): Observable<T> {
    return this.api.delete<T>(this.path(...parts));
  }
}
