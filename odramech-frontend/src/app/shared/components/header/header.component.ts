import { Component, ElementRef, EventEmitter, HostListener, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '@shared/services/auth.service';
import { SessionService } from '@shared/services/session.service';
import { AuthContext } from '@shared/models/AuthContext';
import { CloseOnClickOutsideDirective } from '@shared/directives/close-onclick-outside.directive';
import { InitialsPipe, RoleLabelPipe } from '@shared/ui/pipes';

const SECTION_TITLES: Record<string, string> = {
  home: 'Início',
  orders: 'Ordens de serviço',
  quotes: 'Orçamentos',
  clients: 'Clientes',
  vehicles: 'Veículos',
  settings: 'Configurações',
};

@Component({
  selector: 'app-header',
  imports: [CommonModule, FormsModule, RouterModule, CloseOnClickOutsideDirective, InitialsPipe, RoleLabelPipe],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {

  constructor(
    private readonly _authService: AuthService,
    private readonly _router: Router,
    readonly session: SessionService,
  ) {}

  @Output() estadoMenuChange = new EventEmitter<boolean>();
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  ctx: AuthContext | null = null;
  section = '';
  menuOpen = false;
  search = '';

  private readonly subs = new Subscription();

  ngOnInit(): void {
    this.updateSection(this._router.url);
    this.subs.add(this._router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => this.updateSection(e.urlAfterRedirects)));
    this.subs.add(this._authService.user$.subscribe(ctx => this.ctx = ctx));
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  private updateSection(url: string): void {
    const seg = url.split('?')[0].split('/').filter(Boolean)[0] ?? 'home';
    this.section = SECTION_TITLES[seg] ?? '';
    this.menuOpen = false;
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    const typing = target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
    if (e.key === '/' && !typing) {
      e.preventDefault();
      this.searchInput?.nativeElement.focus();
    }
  }

  submitSearch(): void {
    const term = this.search.trim();
    if (!term) return;
    this._router.navigate(['/orders'], { queryParams: { search: term } });
    this.search = '';
    this.searchInput?.nativeElement.blur();
  }

  toggleCollapse(): void {
    this.estadoMenuChange.emit();
  }

  logout() {
    this.menuOpen = false;
    this._authService.logout().subscribe();
  }
}
