import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { Admin, Dashboard, LicenseDetail, LicenseRow, Plan } from './models';

/**
 * Tudo vai para /api (mesma origem): em dev o proxy do Angular manda para o serviço de assinaturas;
 * em produção o Nginx faz o mesmo. Assim o cookie de sessão é httpOnly + SameSite=Strict e o
 * serviço não precisa liberar CORS para navegador nenhum.
 */
const API = '/api/admin';

/** header exigido pelo serviço em toda escrita do painel (um site de terceiros não consegue enviá-lo) */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const withHeader = req.method === 'GET' ? req : req.clone({ setHeaders: { 'x-odramech-admin': '1' } });
  return next(withHeader).pipe(
    catchError((err: HttpErrorResponse) => {
      // sessão expirou/revogada → volta para o login (exceto a própria tentativa de login e o "quem sou eu")
      if (err.status === 401 && !req.url.endsWith('/auth/login') && !req.url.endsWith('/auth/me')) {
        void router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};

export function errorMessage(err: unknown): string {
  const e = err as HttpErrorResponse;
  const msg = e?.error?.message;
  if (Array.isArray(msg)) return msg.join(' · ');
  if (typeof msg === 'string') return msg;
  if (e?.status === 0) return 'Sem conexão com o serviço de assinaturas.';
  return 'Algo deu errado.';
}

@Injectable({ providedIn: 'root' })
export class Session {
  private readonly http = inject(HttpClient);
  readonly admin = signal<Admin | null>(null);

  async load(): Promise<Admin | null> {
    try {
      const me = await firstValueFrom(this.http.get<Admin>(`${API}/auth/me`));
      this.admin.set(me);
      return me;
    } catch {
      this.admin.set(null);
      return null;
    }
  }

  async login(email: string, password: string, totp?: string) {
    const r = await firstValueFrom(this.http.post<{ admin: Admin }>(`${API}/auth/login`, { email, password, ...(totp && { totp }) }));
    this.admin.set(r.admin);
    return r.admin;
  }

  async logout() {
    try { await firstValueFrom(this.http.post(`${API}/auth/logout`, {})); } finally { this.admin.set(null); }
  }
}

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  dashboard() { return firstValueFrom(this.http.get<Dashboard>(`${API}/dashboard`)); }
  licenses() { return firstValueFrom(this.http.get<{ directoryAvailable: boolean; licenses: LicenseRow[] }>(`${API}/licenses`)); }
  license(id: number) { return firstValueFrom(this.http.get<LicenseDetail>(`${API}/licenses/${id}`)); }

  startTrial(id: number, body: { days?: number; enterpriseName?: string }) {
    return firstValueFrom(this.http.post<LicenseDetail>(`${API}/licenses/${id}/trial`, body));
  }
  grantComplimentary(id: number, body: { planCode: string; until?: string | null; enterpriseName?: string; note?: string }) {
    return firstValueFrom(this.http.post<LicenseDetail>(`${API}/licenses/${id}/complimentary`, body));
  }
  revokeComplimentary(id: number) { return firstValueFrom(this.http.delete<LicenseDetail>(`${API}/licenses/${id}/complimentary`)); }
  changePlan(id: number, planCode: string) { return firstValueFrom(this.http.post<LicenseDetail>(`${API}/licenses/${id}/plan`, { planCode })); }
  setPeriod(id: number, until: string, status?: 'TRIALING' | 'ACTIVE') {
    return firstValueFrom(this.http.post<LicenseDetail>(`${API}/licenses/${id}/period`, { until, ...(status && { status }) }));
  }
  suspend(id: number, reason: string) { return firstValueFrom(this.http.post<LicenseDetail>(`${API}/licenses/${id}/suspend`, { reason })); }
  unsuspend(id: number) { return firstValueFrom(this.http.delete<LicenseDetail>(`${API}/licenses/${id}/suspend`)); }
  setNote(id: number, note: string) { return firstValueFrom(this.http.put<LicenseDetail>(`${API}/licenses/${id}/note`, { note })); }

  markPaid(invoiceId: string) { return firstValueFrom(this.http.post<LicenseDetail>(`${API}/invoices/${invoiceId}/mark-paid`, {})); }
  voidInvoice(invoiceId: string) { return firstValueFrom(this.http.post<LicenseDetail>(`${API}/invoices/${invoiceId}/void`, {})); }

  plans() { return firstValueFrom(this.http.get<Plan[]>(`${API}/plans`)); }
  updatePlan(id: number, body: Partial<Plan>) { return firstValueFrom(this.http.put<Plan>(`${API}/plans/${id}`, body)); }
  createPlan(body: Partial<Plan>) { return firstValueFrom(this.http.post<Plan>(`${API}/plans`, body)); }
  runLifecycle() { return firstValueFrom(this.http.post<{ ok: number; failed: number }>(`${API}/run-lifecycle`, {})); }
}

/** aviso simples no canto da tela */
@Injectable({ providedIn: 'root' })
export class Toast {
  readonly current = signal<{ text: string; error: boolean } | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(text: string, error = false) {
    this.current.set({ text, error });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.current.set(null), error ? 6000 : 3500);
  }
  error(err: unknown) { this.show(errorMessage(err), true); }
}
