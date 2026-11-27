import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiRepository } from '../../core/http/api-repository';
import { WorkOrderCreate } from '@shared/models/WorkOrderCreate';
import {
  Appointment,
  WorkOrder,
  WorkOrderDetail,
  WorkOrderListQuery,
  WorkOrderPage,
  WorkOrderStats,
} from '@shared/models/WorkOrder';
import { StatusOS } from '@shared/enums/status-os.enum';
import { AppointmentTypeEnum } from '@shared/enums/type-appointment.enum';

/** Resposta de comandos reversíveis: o detalhe atualizado + token para desfazer. */
export type Undoable<T> = T & { undoToken: string | null };

/** REPOSITORY de ordens de serviço. */
@Injectable({ providedIn: 'root' })
export class WorkOrderService extends ApiRepository {
  protected readonly resource = 'workorder';

  create(payload: WorkOrderCreate): Observable<WorkOrder> {
    return this.httpPost(payload);
  }

  list(query: WorkOrderListQuery = {}): Observable<WorkOrderPage> {
    return this.httpList<WorkOrderPage>({ ...query });
  }

  /** visão geral da tela inicial (Facade no backend) */
  stats(): Observable<WorkOrderStats> {
    return this.api.get('dashboard');
  }

  getById(id: number): Observable<WorkOrderDetail> {
    return this.httpGet(id);
  }

  updateStatus(id: number, status: StatusOS): Observable<Undoable<WorkOrderDetail>> {
    return this.httpPut({ status }, id, 'status');
  }

  updateResponsible(id: number, userResponsibleId: number | null): Observable<Undoable<WorkOrderDetail>> {
    return this.httpPut({ userResponsibleId }, id, 'responsible');
  }

  addAppointment(id: number, contentHtml: string, appointmentType: AppointmentTypeEnum): Observable<Appointment> {
    return this.httpPost({ contentHtml, appointmentType }, id, 'appointments');
  }

  undo(token: string): Observable<{ undone: string }> {
    return this.httpPost({ token }, 'undo');
  }
}
