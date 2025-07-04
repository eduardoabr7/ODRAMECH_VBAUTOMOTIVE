import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { NotFoundPageComponent } from './pages/not-found-page/not-found-page.component';

export const routes: Routes = [
    {
    path: '',
    loadChildren: () => import('./pages/layout/layout.routes').then(m => m.LayoutRoutingModule)
    },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: '**',
    component: NotFoundPageComponent
  }
];
