import { Component } from '@angular/core';
import { BaseModalComponent } from '../../base-modal.component';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-modal-create-establishment',
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-create-establishment.component.html',
  styleUrl: './modal-create-establishment.component.scss'
})

export class ModalCreateEstablishmentComponent extends BaseModalComponent {
  constructor(
    bsModalRef: BsModalRef,
    private readonly _toastr: ToastrService,
  ) {
      super(bsModalRef);
  }

  name: string;
  email: string;
  phone: string;
  imageUrl: string | ArrayBuffer | null = null;
  file: File | null = null; //binary file

  generatePreview(event: Event) {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.file = file;

      const reader = new FileReader();
      reader.onload = (e) => {
        this.imageUrl = e.target?.result;
      };
      reader.readAsDataURL(file);
    }
  }
}
