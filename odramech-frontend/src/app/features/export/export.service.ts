import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';
import { NestAPI } from '@shared/services/nest-api.service';
import { QueryParams } from '../../core/http/query-params.builder';

/** documentos exportáveis (mesmos nomes do backend: GET /export/:kind) */
export type ExportKind = 'work-orders' | 'quotes' | 'clients' | 'vehicles' | 'payments';

export interface ExportFilters {
  status?: string | null;
  search?: string | null;
  /** yyyy-mm-dd */
  from?: string | null;
  to?: string | null;
  establishmentId?: number | null;
}

/** Baixa a planilha gerada no backend (respeita permissão e filtros da tela). */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly api = inject(NestAPI);
  private readonly http = inject(HttpClient);

  download(kind: ExportKind, filters: ExportFilters = {}): Observable<string> {
    const url = QueryParams.create().setAll({ ...filters }).appendTo(this.api.url(`export/${kind}`));
    return this.http.get(url, { withCredentials: true, responseType: 'blob', observe: 'response' }).pipe(
      map(res => {
        const name = this.fileName(res) ?? `${kind}.xlsx`;
        this.save(res.body!, name);
        return name;
      }),
      // erro com responseType blob chega como Blob: lê a mensagem JSON do Nest
      catchError((err: HttpErrorResponse) => err.error instanceof Blob
        ? from(err.error.text()).pipe(switchMap(text => throwError(() => ({ ...err, error: this.parse(text) }))))
        : throwError(() => err)),
    );
  }

  private save(blob: Blob, name: string): void {
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // dá tempo do navegador (inclusive no celular) começar o download
    setTimeout(() => URL.revokeObjectURL(href), 30_000);
  }

  private fileName(res: HttpResponse<Blob>): string | null {
    const cd = res.headers.get('Content-Disposition') ?? '';
    const utf = /filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1];
    if (utf) return decodeURIComponent(utf);
    return /filename="?([^";]+)"?/i.exec(cd)?.[1] ?? null;
  }

  private parse(text: string): any {
    try { return JSON.parse(text); } catch { return { message: text }; }
  }
}
