import { Component } from '@angular/core';
import { HeaderComponent } from '../../components/header/header.component';
import { LeftMenuComponent } from '../../components/left-menu/left-menu.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-layout',
  imports: [LeftMenuComponent, HeaderComponent, RouterModule],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent {
  closeMenu = true;

  onEstadoMenuChange() {
    this.closeMenu = !this.closeMenu;
  }
}
