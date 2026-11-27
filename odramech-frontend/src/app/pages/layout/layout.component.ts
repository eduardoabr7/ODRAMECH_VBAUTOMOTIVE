import { Component, HostListener, effect, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ConnectionService } from '@shared/services/connection.service';
import { SessionService } from '@shared/services/session.service';
import { AuthService } from '@shared/services/auth.service';
import { SubscriptionBannerComponent } from '../../features/subscription/subscription-banner.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { LeftMenuComponent } from '../../shared/components/left-menu/left-menu.component';
import { BrandingService } from '../../features/branding/branding.service';

@Component({
  selector: 'app-layout',
  imports: [LeftMenuComponent, HeaderComponent, RouterModule, SubscriptionBannerComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  collapsed = false;
  mobileOpen = false;

  /** recriar o router-outlet força a página atual a buscar os dados de novo */
  outletAlive = true;

  readonly isStaff = toSignal(inject(SessionService).isStaff$, { initialValue: false });

  constructor(private readonly _router: Router, connection: ConnectionService) {
    // tema da empresa (logo, nome, cor) assim que entra no sistema
    const brand = inject(BrandingService);
    brand.load();

    // ícone da aba: foto do estabelecimento escolhido (ou logo do tema; senão o do Odramech)
    const ctx = toSignal(inject(AuthService).user$, { initialValue: null });
    effect(() => {
      brand.branding(); // refaz quando o tema carregar (logo da empresa é o plano B)
      brand.faviconForSession(ctx()?.usercorp?.establishment?.logoUrl);
    });

    this._router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: NavigationEnd) => {
      this.mobileOpen = false;
    });

    connection.reconnected$.pipe(takeUntilDestroyed()).subscribe(() => this.reloadPage());
  }

  private reloadPage(): void {
    this.outletAlive = false;
    setTimeout(() => this.outletAlive = true);
  }

  toggleCollapse(): void { this.collapsed = !this.collapsed; }
  toggleMobile(): void { this.mobileOpen = !this.mobileOpen; }

  @HostListener('document:keydown.escape')
  closeMobile(): void { this.mobileOpen = false; }
}
