import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from '@shared/services/auth.service';

export function initializeApp(authService: AuthService) {
  return () => {
    return authService.getUserLogged().toPromise()
      .then(user => {
        authService.setStatusLogin('on');
        authService.setUserLogged(user);
      })
      .catch(error => {
        authService.setStatusLogin('off');
        authService.setUserLogged(null);
      });
  };
}

export const appInitializers = [
  {
    provide: APP_INITIALIZER,
    useFactory: initializeApp,
    deps: [AuthService],
    multi: true
  }
];
