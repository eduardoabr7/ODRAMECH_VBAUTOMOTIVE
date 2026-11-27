import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { env } from '../../../environments/environment'
import { FormsModule } from '@angular/forms';
import { AuthService } from '@shared/services/auth.service';
import { LoginData } from '@shared/models/LoginData';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { BsModalService } from 'ngx-bootstrap/modal';
import { UserLogged } from '@shared/models/UserLogged';
import { UserCorporationService } from '@shared/services/user-corporation.service';
import { EMPTY, finalize, map, Observable, of, switchMap, tap } from 'rxjs';
import { ModalSelectEstablishment } from '@shared/components/modals/establishment-modals/modal-select-establishment/modal-select-establishment.component';
import { PreLogin } from '@shared/models/PreLogin';
import { EnterpriseWithEstablishments } from '@shared/models/EnterpriseWithEstablishment';
import { Enterprise } from '@shared/models/Enterprise';
import { Establishment } from '@shared/models/Establishment';
import { EnterpriseService } from '@shared/services/enterprise.service';
import { ModalSelectEnterpriseComponent } from '@shared/components/modals/enterprise-modals/modal-select-enterprise/modal-select-enterprise.component';
import { PublicBranding } from '@shared/models/Settings';
import { SettingsService } from '@shared/services/settings.service';
import { BrandingService, DEFAULT_BRAND } from '../../features/branding/branding.service';
@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})

export class LoginComponent implements OnInit {
  private readonly _activated = inject(ActivatedRoute);
  private readonly _settings = inject(SettingsService);
  private readonly _brandingService = inject(BrandingService);

  /** marca da oficina, só pelo link /login?marca= */
  brand: PublicBranding | null = null;
  readonly DEFAULT_BRAND = DEFAULT_BRAND;

  get brandName(): string { return this.brand?.displayName || DEFAULT_BRAND.name; }
  get brandLogo(): string { return this.brand?.logoUrl || DEFAULT_BRAND.logo; }

  constructor(
    private readonly _authService: AuthService,
    private readonly _toastr: ToastrService,
    private readonly _route: Router,
    private readonly _bsModalService: BsModalService,
    private readonly _corporationService : UserCorporationService,
    private readonly _enterpriseService: EnterpriseService
  ){}
  
  loadingLogin = false;
  showPassword = false;
  year = new Date().getFullYear();
  email: string;
  password: string;

  ngOnInit(): void {
    // fora da sessão nada de oficina: nome, cor, ícone e título voltam ao Odramech
    this._brandingService.reset();

    // única exceção: o link próprio da oficina (/login?marca=…), aberto de propósito
    const key = this._activated.snapshot.queryParamMap.get('marca');
    if (!key) return;
    this._settings.publicBranding(key).subscribe({
      next: b => this.applyBrand(b),
      error: () => this._toastr.info('Link de login da oficina inválido.'),
    });
  }

  private applyBrand(b: PublicBranding | null): void {
    this.brand = b;
    this._brandingService.applyAccent(b?.accentColor ?? null);
    if (typeof document !== 'undefined') document.title = `Entrar · ${this.brandName}`;
  }

  formValido(email: string, password: string): boolean {
    if (!email || !password) {
      this._toastr.warning('Preencha todas as informações', 'Atenção');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailValido = emailRegex.test(email);

    if (!isEmailValido) {
      this._toastr.warning('Insira um e-mail válido', 'Atenção');
      return false;
    }

    return true;
  }

  tryLogin() {
    if (!this.formValido(this.email, this.password)) return
    this.loadingLogin = true;

    const dataToSend: PreLogin = {
      email: this.email,
      password: this.password
    };


    this._authService.preLogin(dataToSend)
    .pipe(
      finalize(()=>{
        this.loadingLogin = false
      }),
      switchMap(
        ()=> this.getUserCorp()
      ),
      switchMap(corps => {
        if (!corps.length) {
          this._toastr.info('Verifique com seu mecânico', 'Seu usuário não está vinculado a uma empresa')
          return EMPTY
        }
        if (this.haveMultiTenant(corps)) {
          return this.openSelectEntepriseModal(corps);
        }
      
        return of(corps[0]);
      }),
      switchMap(selectedEnterprise => {
        if (!selectedEnterprise) return EMPTY; // IF NOT SELECTED ENTERPRISE
      
        const establishmentsOnUser = selectedEnterprise.establishments || [];
      
        return of(establishmentsOnUser);
      }),
      switchMap(establishments => {
        if (establishments.length > 1) {
          return this.openSelectEstablishmentModal(establishments);
        } else {
          return of(establishments[0]);
        }
      }),
      switchMap(establishmentSelected => {
        if(!establishmentSelected) return EMPTY // IF NO ESTABLISHMENT IS SELECTED

        const idEstablishmentSelected = establishmentSelected.id

        const dataToLogin = {tenantId: idEstablishmentSelected, ...dataToSend}

        return this._authService.login(dataToLogin)
      })
    )
    .subscribe({
      error: (err: HttpErrorResponse)=> {
        const msg = err?.error?.message;
        // usuário desativado / sem vínculo ativo: mostra o motivo; senão, mensagem genérica
        if (msg && msg !== 'Invalid credentials') this._toastr.error(msg, 'Acesso não permitido')
        else this._toastr.error('Credenciais inválidas', 'Verifique as informações')
      }
    }
    );
  }

  getUserCorp(): Observable<Enterprise[]> {
    return this._corporationService.getUserCorporation()
  }

  getEstablishmentsForEnterprise(idEtp): Observable<Establishment[]> {
    return this._enterpriseService.getEstablishmentsForEnterprise(idEtp)
  }

  haveMultiTenant(corp: Enterprise[]): boolean {
    return corp.length > 1
  }

  openSelectEntepriseModal( enterprises: Enterprise[]): Observable<Enterprise> {

    this.loadingLogin = true;

    const modalRef = this._bsModalService.show(
      ModalSelectEnterpriseComponent,
      {
        initialState: {
          title: 'Empresas que você possui cadastro',
          corps: enterprises
        },
        class: 'modal-md'
      }
    );

    modalRef.onHidden?.subscribe(() => {
      this.loadingLogin = false;
    })

    return modalRef.content.onClose.pipe(
      finalize(() => {
        this.loadingLogin = false;
      })
    );
  }

  openSelectEstablishmentModal( est: Establishment[]): Observable<Establishment> {

    this.loadingLogin = true;

    const modalRef = this._bsModalService.show(
      ModalSelectEstablishment,
      {
        initialState: {
          title: 'Selecione o estabelecimento',
          establishments: est
        },
        class: 'modal-md'
      }
    );

    modalRef.onHidden?.subscribe(() => {
      this.loadingLogin = false;
    })

    return modalRef.content.onClose.pipe(
      finalize(() => {
        this.loadingLogin = false;
      })
    );
  }


}


