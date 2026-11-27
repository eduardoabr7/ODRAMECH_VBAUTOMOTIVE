import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { catchError, throwError } from 'rxjs';
import { SubscriptionFacade } from '../../features/subscription/subscription.facade';

/**
 * DECORATOR (cadeia de interceptors) — toda resposta 402 (assinatura inativa, modo somente
 * leitura) vira um aviso único com atalho para regularizar. As telas não tratam isso.
 */
export const SubscriptionRequiredInterceptor: HttpInterceptorFn = (req, next) => {
  const toastr = inject(ToastrService);
  const router = inject(Router);
  const facade = inject(SubscriptionFacade);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 402) {
        facade.refreshAccess();
        const t = toastr.warning(
          'O sistema está em modo somente leitura. Toque aqui para regularizar.',
          'Assinatura inativa',
          { timeOut: 8000 },
        );
        t?.onTap.subscribe(() => router.navigateByUrl('/settings/subscription'));
      }
      return throwError(() => error);
    }),
  );
};
