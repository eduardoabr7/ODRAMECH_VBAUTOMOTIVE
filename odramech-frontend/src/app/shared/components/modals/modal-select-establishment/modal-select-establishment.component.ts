import { Component, Input } from '@angular/core';
import { BaseModalComponent } from '../base-modal.component';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { Establishment } from '@shared/models/Establishment';

@Component({
  selector: 'app-modal-select-establishment',
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './modal-select-establishment.component.html',
  styleUrl: './modal-select-establishment.component.scss'
})
export class ModalSelectEstablishment extends BaseModalComponent {

  @Input() establishments: Establishment[]
  filteredCorps: Establishment[] = []
  searchTerm: string = ''

  constructor(bsModalRef: BsModalRef) {
      super(bsModalRef);
  }

  ngOnInit(){
    this.filteredCorps = this.establishments
  }

  filterEstablishments() {
    if (!this.searchTerm.trim()) {
      this.filteredCorps = this.establishments
      return
    }

    const term = this.searchTerm.toLowerCase()
    this.filteredCorps = this.establishments.filter(enterprise => 
      enterprise.name.toLowerCase().includes(term)
    )
  }

  selectEstablishment(event: Establishment) {
    this.confirm(event)
  }
}
