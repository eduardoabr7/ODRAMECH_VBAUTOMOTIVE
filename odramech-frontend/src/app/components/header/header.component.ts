import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {

  @Output() estadoMenuChange = new EventEmitter<boolean>();

  toggleCollapse(): void {
    this.estadoMenuChange.emit()
  }

}
