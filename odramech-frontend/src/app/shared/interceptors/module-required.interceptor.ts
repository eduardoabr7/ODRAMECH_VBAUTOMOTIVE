import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { catchError, throwError } from 'rxjs';
import { ContractedModule, ContractedModulesService, MODULE_LABEL, MODULE_ROUTE } from '../../features/modules/contracted-modules.service';

/** a tela do estoque dispara várias chamadas juntas: um aviso só */
let lastNotice = 0;

/**
 * DECORATOR (cadeia de interceptors) — 403 MODULE_REQUIRED significa que o contrato do módulo
 * acabou (suspenso/encerrado/vencido) com a tela aberta. Esconde o módulo na hora e, se a pessoa
 * estiver nele, volta para o início com um aviso. As telas não tratam isso.
 */
export const ModuleRequiredInterceptor: HttpInterceptorFn = (req, next) => {
  const modules = inject(ContractedModulesService);
  const router = inject(Router);
  const toastr = inject(ToastrService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const module = error.status === 403 && error.error?.code === 'MODULE_REQUIRED' ? (error.error.module as ContractedModule) : null;
      if (module && MODULE_LABEL[module]) {
        modules.markInactive(module);
        const route = MODULE_ROUTE[module];
        if (router.url.split('?')[0].startsWith(route)) void router.navigateByUrl('/home');
        if (Date.now() - lastNotice > 3000) {
          lastNotice = Date.now();
          toastr.info(`O módulo ${MODULE_LABEL[module]} não está mais ativo para esta empresa.`, 'Módulo indisponível');
        }
      }
      return throwError(() => error);
    }),
  );
};
