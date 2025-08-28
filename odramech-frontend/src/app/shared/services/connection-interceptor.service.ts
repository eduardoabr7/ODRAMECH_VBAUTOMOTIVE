import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { catchError, throwError } from 'rxjs';

export const ConnectionInterceptor: HttpInterceptorFn = (req, next) => {
  const _toastr = inject(ToastrService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        _toastr.error('Entre em contato com o Administrador', 'Sem conexão com o servidor');
        return throwError(() => new Error('Connection failed'));
      }

      return throwError(() => error);
    })
  );
};