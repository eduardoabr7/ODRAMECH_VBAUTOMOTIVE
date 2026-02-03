import { Component, OnInit } from '@angular/core';
import { LeftMenuComponent } from '../../shared/components/left-menu/left-menu.component'
import { AuthService } from '@shared/services/auth.service';
import { RecentServicesComponent } from '@shared/components/recent-services/recent-services.component';
import { UserRemindersComponent } from '@shared/components/user-reminders/user-reminders.component';
import { UserLogged } from '@shared/models/UserLogged';
import { Router } from '@angular/router';
@Component({
  selector: 'app-homepage',
  imports: [LeftMenuComponent, RecentServicesComponent, UserRemindersComponent],
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.scss'
})
export class HomepageComponent {

  authContext = null;
  userLogged: UserLogged
  corpLogged = null;

  constructor(
    private readonly _authservice: AuthService,
    private readonly _router: Router
  ){}

  ngOnInit() {
    this._authservice.user$.subscribe({
      next: (authCtx) => {
        this.authContext = authCtx;
        this.userLogged = authCtx.user;
        this.corpLogged = authCtx.usercorp;
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  navigate(eve) {
    this._router.navigateByUrl(`/${eve}`)
  }

}
