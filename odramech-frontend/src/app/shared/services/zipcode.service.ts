import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";


interface AddressReturn {
  cep: string,
  logradouro: string,
  complemento: string,
  bairro: string,
  localidade: string,
  uf: string,
  ibge: string
}

@Injectable({
  providedIn: 'root'
})
export class ZipCodeService {
    constructor(
        private readonly _httpClient: HttpClient
    ) {}

//return this._httpClient.get<T>(`${this.baseAPI}/${endpoint}`, { withCredentials: true });

    get(zipcode: string): Observable<AddressReturn> {
        return this._httpClient.get<AddressReturn>(`https://opencep.com/v1/${zipcode}`);
    }
}