import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { NotFoundPageComponent } from './pages/not-found-page/not-found-page.component';
import { HomepageComponent } from './pages/homepage/homepage.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'home',
    component: HomepageComponent
  },
  {
    path: '**',
    component: NotFoundPageComponent
  }
];
