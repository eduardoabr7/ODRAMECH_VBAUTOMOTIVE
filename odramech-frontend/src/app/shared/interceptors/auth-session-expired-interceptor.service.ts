import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpRequest } from "@angular/common/http";
import { Observable, catchError, throwError } from "rxjs";
import { inject } from "@angular/core";
import { AuthService } from "../services/auth.service";
import { ToastrService } from "ngx-toastr";

export function AuthSessionExpiredInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {

    const authService = inject(AuthService)
    const _toastr = inject(ToastrService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {

      const isAuthRequest =
        req.url.includes('/session') ||
        req.url.includes('/login');

      if (error.status === 401 && !isAuthRequest) {
        authService.forceLogout()
      }

      return throwError(() => error);
    })
  );
}
