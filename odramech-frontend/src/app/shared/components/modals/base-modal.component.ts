import { BsModalRef } from 'ngx-bootstrap/modal';
import { Subject } from 'rxjs';

export class BaseModalComponent<T = any> {
  title: string;
  message: string;
  hasUnsavedChanges = false;
  onClose: Subject<T | null> = new Subject<T | null>();

  constructor(public bsModalRef: BsModalRef) {}

  /** 🔵 CONFIRMAR — fecha retornando dados */
  confirm(result?: T) {
    this.onClose.next(result);
    this.onClose.complete();
    this.closeImmediately();
  }

  /** 🔴 CANCELAR — fecha sem retornar nada */
  cancel() {
    this.onClose.next(null);
    this.onClose.complete();
    this.closeImmediately();
  }

  /** 🟡 Fechar com verificação de alterações não salvas */
  attemptClose(questWantToExit?: boolean): void {

    if (this.hasUnsavedChanges || questWantToExit) {
      const wantsToExit = confirm(
        'Você tem certeza que quer sair sem salvar? As alterações serão perdidas.'
      );

      if (!wantsToExit) {
        return;
      }
    }

    this.cancel();
  }

  onHide(): Promise<any> {
    return new Promise(resolve => {
      this.onClose.subscribe(result => resolve(result));
    });
  }

  /** ⚫ Fecha a modal direto (uso interno) */
  protected closeImmediately() {
    this.bsModalRef.hide();
  }
}
