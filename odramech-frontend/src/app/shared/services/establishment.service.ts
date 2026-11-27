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
}
