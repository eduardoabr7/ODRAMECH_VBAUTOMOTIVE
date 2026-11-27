import { Component, OnInit } from '@angular/core';
import { BaseModalComponent } from '../../base-modal.component';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { EstablishmentCreate } from '@shared/models/EstablishmentCreate';
import { imageToDataUrl } from '@shared/utils/image-data-url';

@Component({
  selector: 'app-modal-create-establishment',
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-create-establishment.component.html',
  styleUrl: './modal-create-establishment.component.scss'
})

export class ModalCreateEstablishmentComponent extends BaseModalComponent implements OnInit {
  constructor(
    bsModalRef: BsModalRef,
    private readonly _toastr: ToastrService,
  ) {
      super(bsModalRef);
  }

  imageUrl: string | null = null;
  loadingPhoto = false;

  withCadEnterprise: boolean = false;
  /** preenchido = modo edição (o modal devolve os dados alterados para quem abriu) */
  editing: (EstablishmentCreate & { id: number }) | null = null;

  formData: EstablishmentCreate = {
    name: '',
    email: '',
    phone: '',
    cnpj: '',
    address: {
      street: '',
      number: '',
      complement: '',
      city: '',
      district: '',
      zipCode: '',
      country: '',
      neighborhood: ''
    }
  };

  ngOnInit(): void {
    if (!this.editing) return;
    const e = this.editing;
    this.formData = {
      name: e.name ?? '',
      email: e.email ?? '',
      phone: e.phone ?? '',
      cnpj: e.cnpj ?? '',
      logoUrl: e.logoUrl ?? undefined,
      address: {
        street: e.address?.street ?? '', number: e.address?.number ?? '', complement: e.address?.complement ?? '',
        city: e.address?.city ?? '', district: e.address?.district ?? '', zipCode: e.address?.zipCode ?? '',
        country: e.address?.country ?? '', neighborhood: e.address?.neighborhood ?? '',
      },
    };
    this.imageUrl = e.logoUrl ?? null;
  }

  /** foto reduzida no navegador (máx. 600 px, ~1 MB) e enviada como data URL */
  async generatePreview(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.loadingPhoto = true;
    try {
      const url = await imageToDataUrl(file, { max: 600, keepTransparency: file.type === 'image/png', maxBytes: 1_000_000 });
      this.imageUrl = url;
      this.formData.logoUrl = url;
    } catch (e: any) {
      this._toastr.warning(e?.message ?? 'Imagem inválida.');
    } finally {
      this.loadingPhoto = false;
    }
  }

  removePhoto() {
    this.imageUrl = null;
    this.formData.logoUrl = null as any;
  }

  prosseguir(form: NgForm) {

    if(form.invalid){
      this._toastr.error('Preencha corretamente todas as informações obrigatórias.', 'Erro de Validação');

      return
    }

    // se foi chamado juntamente ao cadastro de empresa, só confirma pra fechar o modal enviando os dados pra modal pai
    if(this.withCadEnterprise)
      this.confirm(this.formData)
  }
}
