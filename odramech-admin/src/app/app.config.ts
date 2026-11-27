import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { CanActivateFn, provideRouter, Router, Routes, withComponentInputBinding } from '@angular/router';
import { inject } from '@angular/core';
import { csrfInterceptor, Session } from './core/api.service';

registerLocaleData(localePt);

/** sem sessão de administrador → login (a proteção de verdade é no servidor; isto só organiza a navegação) */
const authGuard: CanActivateFn = async () => {
  const session = inject(Session);
  const router = inject(Router);
  if (session.admin() || (await session.load())) return true;
  return router.parseUrl('/login');
};

const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login.page').then(m => m.LoginPage) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./pages/dashboard.page').then(m => m.DashboardPage) },
      { path: 'licencas', loadComponent: () => import('./pages/licenses.page').then(m => m.LicensesPage) },
      { path: 'licencas/:enterpriseId', loadComponent: () => import('./pages/license-detail.page').then(m => m.LicenseDetailPage) },
      { path: 'planos', loadComponent: () => import('./pages/plans.page').then(m => m.PlansPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([csrfInterceptor])),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
  ],
};
