import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { AuthService } from './auth.service';
import { RoleEnum } from '@shared/enums/role.enum';

/** Atalhos derivados do contexto de autenticação (somente leitura). */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly _auth = inject(AuthService);

  readonly ctx$ = this._auth.user$;

  readonly role$ = this._auth.user$.pipe(
    map(ctx => (ctx?.usercorp?.establishment?.role ?? null) as unknown as RoleEnum | null),
  );

  readonly isStaff$ = this.role$.pipe(
    map(role => role === RoleEnum.ADMIN || role === RoleEnum.WORKER || role === RoleEnum.SUPERUSER),
  );

  readonly isManager$ = this.role$.pipe(
    map(role => role === RoleEnum.ADMIN || role === RoleEnum.SUPERUSER),
  );
}
