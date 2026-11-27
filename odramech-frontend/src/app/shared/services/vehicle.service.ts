import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NestAPI } from './nest-api.service';
import { Vehicle, VehicleListItem } from '@shared/models/Vehicle';
import { VehicleCreate } from '@shared/models/VehicleCreate';

@Injectable({
  providedIn: 'root',
})
export class VehicleService {

  constructor(private readonly _nestApi: NestAPI) {}

  create(payload: VehicleCreate): Observable<Vehicle> {
    return this._nestApi.post('vehicle', payload);
  }

  list(search?: string): Observable<VehicleListItem[]> {
    const qs = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
    return this._nestApi.get(`vehicle${qs}`);
  }

  getByUser(userId: number): Observable<Vehicle[]> {
    return this._nestApi.get(`vehicle/user/${userId}`);
  }

  update(id: number, payload: Partial<VehicleCreate>): Observable<Vehicle> {
    return this._nestApi.put(`vehicle/${id}`, payload);
  }

  linkToUser(vehicleId: number, userId: number): Observable<void> {
    return this._nestApi.post('vehicle/link', { vehicleId, userId });
  }

  checkPlate(plate: string): Observable<{ exists: boolean; vehicle?: Vehicle }> {
    return this._nestApi.get(`vehicle/check-plate/${encodeURIComponent(plate)}`);
  }
}
