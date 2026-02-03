import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { BaseModalComponent } from "../base-modal.component";
import { BsModalRef } from "ngx-bootstrap/modal";

@Component({
  selector: 'app-modal-create-user',
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-create-user.component.html',
  styleUrl: './modal-create-user.component.scss'
})

export class ModalCreateUserComponent extends BaseModalComponent {
    constructor(
      bsModalRef: BsModalRef,
    ) {
        super(bsModalRef);
    }

    cep: string;
    displayAddress: boolean = false;
    displayEmailPassword: boolean = true;
    passwordHidden: boolean = true;

    buscaCep() {
        console.log(this.cep)
    }

}