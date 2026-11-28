import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '@shared/services/auth.service';
import { AuthContext } from '@shared/models/AuthContext';
import { RoleEnum } from '@shared/enums/role.enum';
import { InitialsPipe, RoleLabelPipe } from '@shared/ui/pipes';
import { BrandingService } from '../../../features/branding/branding.service';
import { ContractedModule, ContractedModulesService } from '../../../features/modules/contracted-modules.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  staffOnly?: boolean;
  clientLabel?: string;
  /** só aparece para empresas que contrataram o módulo */
  module?: ContractedModule;
}

@Component({
  selector: 'app-left-menu',
  imports: [CommonModule, RouterModule, InitialsPipe, RoleLabelPipe],
  templateUrl: './left-menu.component.html',
  styleUrl: './left-menu.component.scss',
})
export class LeftMenuComponent implements OnInit, OnDestroy {
  /** logo e nome da oficina (tema) no lugar do Odramech */
  readonly brand = inject(BrandingService);
  private readonly modules = inject(ContractedModulesService);

  constructor(
    private readonly _authService: AuthService,
    private readonly _router: Router
  ) {}

  @Output() estadoMenuChange = new EventEmitter<boolean>();
  @Input() isCollapsed = false;

  authContext: AuthContext | null = null;
  role: RoleEnum | null = null;
  currentUrl = '';

  private readonly subs = new Subscription();

  private readonly operation: NavItem[] = [
    { label: 'Início',            icon: 'fa-solid fa-house',            route: '/home' },
    { label: 'Ordens de serviço', icon: 'fa-solid fa-screwdriver-wrench', route: '/orders', clientLabel: 'Meus serviços' },
    { label: 'Orçamentos',        icon: 'fa-solid fa-file-invoice-dollar', route: '/quotes', clientLabel: 'Meus orçamentos' },
    { label: 'Clientes',          icon: 'fa-solid fa-user-group',       route: '/clients', staffOnly: true },
    { label: 'Veículos',          icon: 'fa-solid fa-car-side',         route: '/vehicles', clientLabel: 'Meus veículos' },
    { label: 'Estoque',           icon: 'fa-solid fa-boxes-stacked',    route: '/inventory', staffOnly: true, module: 'INVENTORY' },
  ];

  private readonly management: NavItem[] = [
    { label: 'Configurações', icon: 'fa-solid fa-sliders', route: '/settings', staffOnly: true },
  ];

  get isStaff(): boolean {
    return this.role === RoleEnum.ADMIN || this.role === RoleEnum.WORKER || this.role === RoleEnum.SUPERUSER;
  }

  get operationItems(): NavItem[] { return this.visible(this.operation); }
  get managementItems(): NavItem[] { return this.visible(this.management); }

  private visible(items: NavItem[]): NavItem[] {
    return items
      .filter(i => !i.staffOnly || this.isStaff)
      .filter(i => !i.module || this.modules.has(i.module))
      .map(i => (!this.isStaff && i.clientLabel ? { ...i, label: i.clientLabel } : i));
  }

  /** índice do item ativo dentro do grupo — usado pelo indicador deslizante */
  activeIndex(items: NavItem[]): number {
    return items.findIndex(i => this.isActive(i.route));
  }

  ngOnInit(): void {
    this.currentUrl = this._router.url;

    this.subs.add(
      this._router.events.pipe(filter(e => e instanceof NavigationEnd))
        .subscribe((e: NavigationEnd) => this.currentUrl = e.urlAfterRedirects)
    );

    this.subs.add(
      this._authService.user$.subscribe(ctx => {
        this.authContext = ctx;
        this.role = (ctx?.usercorp?.establishment?.role ?? null) as unknown as RoleEnum | null;
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  isActive(route: string): boolean {
    const url = this.currentUrl.split('?')[0];
    return url === route || url.startsWith(route + '/');
  }

  logout(): void {
    this._authService.logout().subscribe();
  }

  toggleCollapse(): void {
    this.estadoMenuChange.emit(!this.isCollapsed);
  }
}
