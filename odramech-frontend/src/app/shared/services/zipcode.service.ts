import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

/** Endereço no vocabulário do sistema (o mesmo do backend: district = UF). */
export interface CepAddress {
  zipCode: string;
  street: string;
  complement: string;
  neighborhood: string;
  city: string;
  district: string;
}

/** Formato cru da OpenCEP — conhecido SOMENTE por este arquivo. */
interface OpenCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
}

/**
 * ADAPTER — converte a API pública de CEP para o modelo do sistema.
 * Trocar de provedor (ViaCEP, BrasilAPI…) muda só este arquivo; formulários não sabem de onde vem.
 */
@Injectable({ providedIn: 'root' })
export class ZipCodeService {
  constructor(private readonly http: HttpClient) {}

  lookup(zipcode: string): Observable<CepAddress> {
    const cep = zipcode.replace(/\D/g, '');
    return this.http.get<OpenCepResponse>(`https://opencep.com/v1/${cep}`).pipe(map(r => this.adapt(r)));
  }

  private adapt(r: OpenCepResponse): CepAddress {
    return {
      zipCode: (r.cep ?? '').replace(/\D/g, ''),
      street: r.logradouro ?? '',
      complement: (r.complemento ?? '').trim(),
      neighborhood: r.bairro ?? '',
      city: r.localidade ?? '',
      district: r.uf ?? '',
    };
  }
}
