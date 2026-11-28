import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { LayoutComponent } from './pages/layout/layout.component';
import { AuthGuard } from './guards/Authentication.guard';
import { requireModule } from './features/modules/module.guard';

export const routes: Routes = [

  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        title: 'Início · Odramech',
        loadComponent: () => import('./pages/homepage/homepage.component').then(m => m.HomepageComponent),
      },
      {
        path: 'orders',
        title: 'Ordens de serviço · Odramech',
        loadComponent: () => import('./pages/OS/orders-list/orders-list.component').then(m => m.OrdersListComponent),
      },
      {
        path: 'orders/new',
        title: 'Nova OS · Odramech',
        loadComponent: () => import('./pages/OS/new-os/new-os.component').then(m => m.NewOsComponent),
      },
      {
        path: 'orders/:id',
        title: 'OS · Odramech',
        loadComponent: () => import('./pages/OS/order-detail/order-detail.component').then(m => m.OrderDetailComponent),
      },
      {
        path: 'quotes',
        title: 'Orçamentos · Odramech',
        loadComponent: () => import('./pages/quotes/quotes-list/quotes-list.component').then(m => m.QuotesListComponent),
      },
      {
        path: 'quotes/new',
        title: 'Novo orçamento · Odramech',
        loadComponent: () => import('./pages/quotes/quote-editor/quote-editor.component').then(m => m.QuoteEditorComponent),
      },
      {
        path: 'quotes/:id',
        title: 'Orçamento · Odramech',
        loadComponent: () => import('./pages/quotes/quote-editor/quote-editor.component').then(m => m.QuoteEditorComponent),
      },
      {
        path: 'clients',
        title: 'Clientes · Odramech',
        loadComponent: () => import('./pages/clients/clients.component').then(m => m.ClientsComponent),
      },
      {
        path: 'clients/:id',
        title: 'Cliente · Odramech',
        loadComponent: () => import('./pages/clients/client-detail/client-detail.component').then(m => m.ClientDetailComponent),
      },
      {
        path: 'vehicles',
        title: 'Veículos · Odramech',
        loadComponent: () => import('./pages/vehicles/vehicles.component').then(m => m.VehiclesComponent),
      },
      {
        // módulo contratado à parte: sem contrato nem carrega a tela (e o backend recusa)
        path: 'inventory',
        title: 'Estoque · Odramech',
        canActivate: [requireModule('INVENTORY')],
        loadComponent: () => import('./features/inventory/inventory-page.component').then(m => m.InventoryPageComponent),
      },
      {
        path: 'settings/subscription',
        title: 'Assinatura · Odramech',
        loadComponent: () => import('./features/subscription/subscription-page.component').then(m => m.SubscriptionPageComponent),
      },
      {
        path: 'settings/quote-document',
        title: 'Documento de orçamento · Odramech',
        loadComponent: () => import('./features/quote-document/quote-document-settings.component').then(m => m.QuoteDocumentSettingsComponent),
      },
      {
        path: 'settings/work-order',
        title: 'Ordens de serviço · Configurações · Odramech',
        loadComponent: () => import('./features/work-order-settings/work-order-settings.component').then(m => m.WorkOrderSettingsComponent),
      },
      {
        path: 'settings/theme',
        title: 'Tema e marca · Odramech',
        loadComponent: () => import('./features/branding/theme-settings.component').then(m => m.ThemeSettingsComponent),
      },
      {
        path: 'settings/mail',
        title: 'E-mail de envio · Odramech',
        loadComponent: () => import('./features/mail-settings/mail-settings.component').then(m => m.MailSettingsComponent),
      },
      {
        path: 'settings',
        title: 'Configurações · Odramech',
        loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
      },
    ]
  },

  {
    // link do e-mail do cliente: ver, aprovar ou recusar o orçamento (sem login)
    path: 'orcamento/:token',
    title: 'Orçamento',
    loadComponent: () => import('./features/public-quote/public-quote.component').then(m => m.PublicQuoteComponent),
  },

  {
    path: 'login',
    component: LoginComponent,
    title: 'Entrar · Odramech',
  },

  {
    path: '**',
    loadComponent: () => import('./pages/not-found-page/not-found-page.component').then(m => m.NotFoundPageComponent),
  }
];
