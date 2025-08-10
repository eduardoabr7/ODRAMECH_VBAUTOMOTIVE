import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LeftMenuComponent } from '../app/components/left-menu/left-menu.component'
import { HeaderComponent } from '../app/components/header/header.component'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LeftMenuComponent, HeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'frontend';
}
