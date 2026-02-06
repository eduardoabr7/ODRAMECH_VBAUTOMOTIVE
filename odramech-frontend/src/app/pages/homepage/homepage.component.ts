import { Component, OnInit } from '@angular/core';
import { LeftMenuComponent } from '../../shared/components/left-menu/left-menu.component'
import { AuthService } from '@shared/services/auth.service';
import { RecentServicesComponent } from '@shared/components/recent-services/recent-services.component';
import { UserRemindersComponent } from '@shared/components/user-reminders/user-reminders.component';
import { UserLogged } from '@shared/models/UserLogged';
import { Router } from '@angular/router';
import { AuthContext } from '@shared/models/AuthContext';
@Component({
  selector: 'app-homepage',
  imports: [LeftMenuComponent, RecentServicesComponent, UserRemindersComponent],
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.scss'
})
export class HomepageComponent {

  userLogged: UserLogged | null = null;
  authContext: AuthContext | null = null;
  corpLogged: any = null;

  constructor(
    private readonly _authservice: AuthService,
    private readonly _router: Router
  ){}

  ngOnInit() {
    this._authservice.user$.subscribe(authCtx => {
      this.authContext = authCtx;
      this.userLogged = authCtx?.user ?? null;
      this.corpLogged = authCtx?.usercorp ?? null;
    });
  }

  navigate(eve) {
    this._router.navigateByUrl(`/${eve}`)
  }

}
