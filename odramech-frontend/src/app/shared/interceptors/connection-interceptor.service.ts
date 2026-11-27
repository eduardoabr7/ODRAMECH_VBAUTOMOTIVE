import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ConnectionService } from '@shared/services/connection.service';

/**
 * Falha de rede (status 0) = backend fora do ar.
 * Em vez de um toast por requisição, avisa o ConnectionService, que mostra
 * um aviso único e fica tentando reconectar.
 */
export const ConnectionInterceptor: HttpInterceptorFn = (req, next) => {
  const connection = inject(ConnectionService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        connection.markOffline();
      }
      return throwError(() => error);
    })
  );
};
