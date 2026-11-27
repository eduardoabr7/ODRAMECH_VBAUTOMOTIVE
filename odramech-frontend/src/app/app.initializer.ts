import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '@shared/services/auth.service';
import { ConnectionService } from '@shared/services/connection.service';

export function initializeApp(authService: AuthService, connection: ConnectionService) {
  return () => {
    return authService.getAuthContext().toPromise()
      .then(user => {
        authService.setStatusLogin('on');
        authService.setUserLogged(user);
      })
      .catch((error: HttpErrorResponse) => {
        authService.setStatusLogin('off');
        authService.setUserLogged(null);
        // servidor fora do ar na abertura: começa a tentar reconectar
        if (error?.status === 0) connection.markOffline();
      });
  };
}
