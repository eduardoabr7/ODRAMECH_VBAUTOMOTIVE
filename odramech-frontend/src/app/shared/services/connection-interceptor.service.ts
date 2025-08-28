import { HttpInterceptor, HttpHandler, HttpClient, HttpEvent, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { env } from 'environments/environment';
import { ToastrService } from 'ngx-toastr';
import { catchError, Observable, switchMap, throwError } from 'rxjs';

@Injectable()
export class ConnectionInterceptor implements HttpInterceptor {
  constructor(
    private readonly _toastr: ToastrService,
    private readonly _httpClient: HttpClient
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const statusUrl = `http://${env.hostBackend}:${env.portBackend}/auth/status/connection`;

    // 1. Verifica se a requisição atual não é a de status para evitar loop
    if (req.url === statusUrl) {
      return next.handle(req);
    }

    // 2. Faz a checagem de status antes de enviar a requisição original
    return this._httpClient.get(statusUrl).pipe(
      // Se a checagem de status for bem-sucedida, continua a requisição original
      switchMap(() => next.handle(req)),
      // Se a checagem de status falhar, intercepta e trata o erro
      catchError(error => {
        if (error instanceof HttpErrorResponse && !error.status) {
          this._toastr.error('Entre em contato com o Administrador', 'Sem conexão entre sistemas');
          return throwError(() => new Error('Connection failed'));
        }
        return throwError(() => error);
      })
    );
  }
}