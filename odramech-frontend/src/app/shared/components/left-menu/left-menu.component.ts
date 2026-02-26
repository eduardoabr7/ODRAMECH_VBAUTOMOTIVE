import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '@shared/services/auth.service';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthContext } from '@shared/models/AuthContext';

interface BotoesMenuLateral {
  nome: string;
  icon: string;
  route?: string;
}

@Component({
  selector: 'app-left-menu',
  imports: [CommonModule],
  templateUrl: './left-menu.component.html',
  styleUrl: './left-menu.component.scss',
})
export class LeftMenuComponent implements OnInit, OnDestroy {

  constructor(
    private readonly _authService: AuthService,
    private readonly _router: Router
  ) {}

  @Output() estadoMenuChange = new EventEmitter<boolean>();
  @Input() isCollapsed = true;

  authContext: AuthContext;
  corpLogged = null;
  urlPhotoUser: string | null = null;
  currentUrl = '';

  private subs = new Subscription();

  buttons: BotoesMenuLateral[] = [
    { nome: 'Home',          icon: 'fa-solid fa-house',    route: '/home'          },
    { nome: 'Serviços',      icon: 'fa-solid fa-wrench',   route: '/services'      },
    { nome: 'Meus veículos', icon: 'fa-solid fa-car-side', route: '/vehicles'      },
    { nome: 'Faturamento',   icon: 'fa-solid fa-file',     route: '/billing'       },
    { nome: 'Notificações',  icon: 'fa-solid fa-envelope', route: '/notifications' },
    { nome: 'Clientes',      icon: 'fa-solid fa-users',    route: '/clients'       },
  ];

  ngOnInit(): void {
    this.currentUrl = this._router.url;

    this.subs.add(
      this._router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe((event: NavigationEnd) => {
        this.currentUrl = event.urlAfterRedirects;
      })
    );

    this.subs.add(
      this._authService.user$.subscribe(authCtx => {
        this.authContext = authCtx;
        this.corpLogged = authCtx?.usercorp ?? null;
        this.getUserPhotoURL();
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  getUserPhotoURL(): void {
    this.urlPhotoUser = '../../../assets/remover_foto.jpeg';
  }

  isActive(route?: string): boolean {
    if (!route) return false;
    return this.currentUrl === route || this.currentUrl.startsWith(route + '/');
  }

  logout(): void {
    this._authService.logout().subscribe();
  }

  navigateUrl(option: BotoesMenuLateral): void {
    if (option.route) this._router.navigateByUrl(option.route);
  }

  navigateToSettings(): void {
    this._router.navigateByUrl('/settings');
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.estadoMenuChange.emit(!this.isCollapsed);
  }
}