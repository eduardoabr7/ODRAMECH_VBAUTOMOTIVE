import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NestAPI } from './nest-api.service';
import { EstablishmentCreate } from '@shared/models/EstablishmentCreate';

@Injectable({ providedIn: 'root' })
export class EstablishmentService {
  constructor(private readonly _nestApi: NestAPI) {}

  /** A empresa é definida pelo backend a partir do token; enterpriseId aqui é só para satisfazer o DTO. */
  create(data: EstablishmentCreate, enterpriseId = 0): Observable<EstablishmentCreate & { id: number }> {
    const { id, ...payload } = data;
    return this._nestApi.post('establishment', { ...payload, email: payload.email || undefined, enterpriseId });
  }

  /** edita (só admin do estabelecimento); logoUrl: data URL nova, null remove, ausente mantém */
  update(id: number, data: EstablishmentCreate): Observable<EstablishmentCreate & { id: number }> {
    const { id: _id, address, ...payload } = data;
    return this._nestApi.put(`establishment/${id}`, {
      ...payload,
      email: payload.email || null,
      address: { ...address, complement: address.complement || null },
    });
  }
}
