import { APP_INITIALIZER, ApplicationConfig, importProvidersFrom, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { provideRouter, TitleStrategy } from '@angular/router';
import { BrandTitleStrategy } from './features/branding/brand-title.strategy';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ToastrModule } from 'ngx-toastr';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ConnectionInterceptor } from '@shared/interceptors/connection-interceptor.service';
import { SubscriptionRequiredInterceptor } from '@shared/interceptors/subscription-required.interceptor';
import { ModuleRequiredInterceptor } from '@shared/interceptors/module-required.interceptor';
import { initializeApp } from './app.initializer';
import { AuthService } from '@shared/services/auth.service';
import { ConnectionService } from '@shared/services/connection.service';
import { ModalModule } from 'ngx-bootstrap/modal';
import { provideNgxMask } from 'ngx-mask';
import { AuthSessionExpiredInterceptor } from '@shared/interceptors/auth-session-expired-interceptor.service';

registerLocaleData(localePt);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [AuthService, ConnectionService],
      multi: true
    },
    provideNgxMask(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    { provide: TitleStrategy, useExisting: BrandTitleStrategy },
    provideClientHydration(withEventReplay()),
    provideHttpClient(
      withInterceptors([
        // DECORATOR: cada interceptor acrescenta um comportamento à chamada HTTP, sem tocar nos serviços
        ConnectionInterceptor,
        AuthSessionExpiredInterceptor,
        SubscriptionRequiredInterceptor,
        ModuleRequiredInterceptor,
      ])
    ),
    importProvidersFrom(
      BrowserAnimationsModule,
      ModalModule.forRoot(),
      ToastrModule.forRoot({
        timeOut: 3000,
        positionClass: 'toast-top-right',
        preventDuplicates: true,
      })
    )
  ]
};
