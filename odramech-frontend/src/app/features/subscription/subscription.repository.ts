import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiRepository } from '../../core/http/api-repository';
import { AccessDecision, PaymentMethod, SubscriptionOverview } from './subscription.models';

/** REPOSITORY — endpoints de assinatura do backend da oficina (que conversa com o serviço de assinaturas). */
@Injectable({ providedIn: 'root' })
export class SubscriptionRepository extends ApiRepository {
  protected readonly resource = 'subscription';

  overview(): Observable<SubscriptionOverview> { return this.httpGet(); }
  access(): Observable<AccessDecision> { return this.httpGet('access'); }
  selectPlan(planCode: string, method: PaymentMethod): Observable<SubscriptionOverview> { return this.httpPost({ planCode, method }, 'plan'); }
  pay(invoiceId: string, method: PaymentMethod, cardToken?: string): Observable<SubscriptionOverview> {
    return this.httpPost({ method, cardToken }, 'invoices', invoiceId, 'pay');
  }
  simulate(invoiceId: string): Observable<SubscriptionOverview> { return this.httpPost({}, 'invoices', invoiceId, 'simulate-payment'); }
  cancel(): Observable<SubscriptionOverview> { return this.httpPost({}, 'cancel'); }
  resume(): Observable<SubscriptionOverview> { return this.httpPost({}, 'resume'); }
}
