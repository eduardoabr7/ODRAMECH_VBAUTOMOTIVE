import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NestAPI } from './nest-api.service';
import { Vehicle } from '@shared/models/Vehicle';
import { WorkOrderCreate } from '@shared/models/WorkOrderCreate';
import { WorkOrder } from '@shared/models/WorkOrder';

@Injectable({
  providedIn: 'root',
})
export class WorkOrderService {

  constructor(private readonly _nestApi: NestAPI) {}

  create(payload: WorkOrderCreate): Observable<WorkOrder> {
    return this._nestApi.post('workorder', payload);
  }

}
