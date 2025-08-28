import { Component, OnInit } from '@angular/core';
import { LeftMenuComponent } from '../../components/left-menu/left-menu.component'
import { AuthService } from '@shared/services/auth.service';
@Component({
  selector: 'app-homepage',
  imports: [LeftMenuComponent],
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.scss'
})
export class HomepageComponent {
  constructor(private readonly _authservice: AuthService){}

}
