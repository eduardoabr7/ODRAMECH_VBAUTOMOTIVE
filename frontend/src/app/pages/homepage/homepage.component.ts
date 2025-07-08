import { Component } from '@angular/core';
import { LeftMenuComponent } from '../../components/left-menu/left-menu.component'
import { ViewPrincipalComponent } from '../../components/view-principal/view-principal.component'

@Component({
  selector: 'app-homepage',
  imports: [LeftMenuComponent, ViewPrincipalComponent],
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.scss'
})
export class HomepageComponent {

}
