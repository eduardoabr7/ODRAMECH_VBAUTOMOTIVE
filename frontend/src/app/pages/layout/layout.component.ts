import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../components/header/header.component'
import { LeftMenuComponent } from '../../components/left-menu/left-menu.component'

@Component({
  selector: 'app-layout',
  imports: [HeaderComponent,LeftMenuComponent, CommonModule, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {

  headerVisible = true;
  mobile = true;

}
