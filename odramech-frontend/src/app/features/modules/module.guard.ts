import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ContractedModule, ContractedModulesService, MODULE_LABEL } from './contracted-modules.service';

/**
 * Rota de módulo contratado à parte. Pergunta ao backend a cada entrada (o contrato pode ter
 * mudado no painel desde o login); sem contrato volta para o início. O backend também recusa.
 */
export function requireModule(module: ContractedModule): CanActivateFn {
  return () => {
    const router = inject(Router);
    const toastr = inject(ToastrService);
    return inject(ContractedModulesService).check(module).pipe(
      map(active => {
        if (active) return true;
        toastr.info(`O módulo ${MODULE_LABEL[module]} não está contratado para esta empresa.`);
        return router.createUrlTree(['/home']);
      }),
    );
  };
}
