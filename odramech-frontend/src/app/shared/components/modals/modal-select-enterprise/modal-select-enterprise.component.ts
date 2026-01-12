import { Component, Input } from '@angular/core';
import { BaseModalComponent } from '../base-modal.component';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { NgSelectModule } from '@ng-select/ng-select';
import { Enterprise } from '@shared/models/Enterprise';

@Component({
  selector: 'app-modal-select-enterprise',
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './modal-select-enterprise.component.html',
  styleUrl: './modal-select-enterprise.component.scss'
})

export class ModalSelectEnterpriseComponent extends BaseModalComponent {

  @Input() corps: Enterprise[]
  filteredCorps: Enterprise[] = []
  searchTerm: string = ''

  constructor(
    bsModalRef: BsModalRef,
    private readonly _toastr: ToastrService,
  ) {
      super(bsModalRef);
  }

  ngOnInit(){
    console.log(this.corps.map(c => c.name))
    this.filteredCorps = this.corps
  }

  filterEnterprises() {
    if (!this.searchTerm.trim()) {
      this.filteredCorps = this.corps
      return
    }

    const term = this.searchTerm.toLowerCase()
    this.filteredCorps = this.corps.filter(enterprise => 
      enterprise.name.toLowerCase().includes(term)
    )
  }

  selectEnterprise(event: Enterprise) {
    this.confirm(event)
  }

}