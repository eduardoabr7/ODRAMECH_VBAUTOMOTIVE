import { Component, Input } from '@angular/core';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { NgSelectModule } from '@ng-select/ng-select';
import { Enterprise } from '@shared/models/Enterprise';
import { BaseModalComponent } from '../../base-modal.component';

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

  /** iniciais quando não há foto */
  initials(name: string): string {
    return (name ?? '').trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?';
  }

  color(name: string): string {
    const colors = ['#2563eb', '#16a34a', '#7c3aed', '#dc2626', '#d97706', '#0891b2', '#be185d', '#059669'];
    return colors[(name ?? '').charCodeAt(0) % colors.length || 0];
  }
}
