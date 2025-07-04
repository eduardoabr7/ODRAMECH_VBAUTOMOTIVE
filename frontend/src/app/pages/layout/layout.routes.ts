import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomepageComponent } from '../../../app/pages/homepage/homepage.component';
import { ServicosComponent } from '../../../app/pages/servicos/servicos.component';
import { NotificacoesComponent } from '../../../app/pages/notificacoes/notificacoes.component';
import { LayoutComponent } from './layout.component';

const routes: Routes = [
    {
        path: '',
        component: LayoutComponent,
        children: [
          { path: '', redirectTo: 'home', pathMatch: 'full' },
          { path: 'home', component: HomepageComponent },
          { path: 'servicos', component: ServicosComponent },
          { path: 'notificacoes', component: NotificacoesComponent }
        ]
      }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LayoutRoutingModule {}
