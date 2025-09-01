import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { NotFoundPageComponent } from './pages/not-found-page/not-found-page.component';
import { HomepageComponent } from './pages/homepage/homepage.component';
import { LayoutComponent } from './pages/layout/layout.component';
import { AuthGuard } from './guards/Authentication.guard';

export const routes: Routes = [

  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', component: HomepageComponent },
    ]
  },

  {
    path: 'login',
    component: LoginComponent,
  },


  {
    path: '**',
    component: NotFoundPageComponent
  }
];