import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Output } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@shared/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {

  constructor(
    private readonly _authService: AuthService,
    private readonly _toast: ToastrService,
    private readonly _router: Router
  ) {}

  @Output() estadoMenuChange = new EventEmitter<boolean>();

  toggleCollapse(): void {
    this.estadoMenuChange.emit()
  }

  logout() {
    this._authService.logout().subscribe({
      // Opcional: `complete` ou um `next`, caso precise alguma reação
      // complete: () => {
      //   console.log('Logout completado!');
      // }
    });
  }

}
