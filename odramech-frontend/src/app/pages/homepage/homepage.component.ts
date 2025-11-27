import { Component, OnInit } from '@angular/core';
import { LeftMenuComponent } from '../../shared/components/left-menu/left-menu.component'
import { AuthService } from '@shared/services/auth.service';
import { RecentServicesComponent } from '@shared/components/recent-services/recent-services.component';
import { UserRemindersComponent } from '@shared/components/user-reminders/user-reminders.component';
@Component({
  selector: 'app-homepage',
  imports: [LeftMenuComponent, RecentServicesComponent, UserRemindersComponent],
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.scss'
})
export class HomepageComponent {
  constructor(private readonly _authservice: AuthService){}

}
