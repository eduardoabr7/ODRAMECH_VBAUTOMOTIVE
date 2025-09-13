import { BsModalRef } from 'ngx-bootstrap/modal';

export class BaseModalComponent {
  title?: string;
  message?: string;

  hasUnsavedChanges = false;

  constructor(public bsModalRef: BsModalRef) {}


  // function genérica, pode sobrescrever nos componentes filhos com override hideModal()
  hideModal(): void {
    if (this.hasUnsavedChanges) {
      const confirmation = confirm('Você tem certeza que quer sair sem salvar? As alterações serão perdidas');

      if (confirmation) {
        this.bsModalRef.hide();
      }
    } else { // se não tiver alterações, pode simplesmente chamar o fechamento da modal
      this.bsModalRef.hide();
    }
  }
}