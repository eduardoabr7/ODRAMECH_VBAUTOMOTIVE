import { OrderStatus } from '@prisma/client';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { isStaff } from 'src/shared/utils/role.util';

/** Critério de busca de OS, independente de banco. */
export interface WorkOrderCriteria {
  establishmentId: number;
  /** quando definido, só OS deste cliente (usuário com papel de cliente) */
  onlyClientId?: number;
  status?: OrderStatus;
  clientId?: number;
  vehicleId?: number;
  /** texto livre: nº da OS, placa, cliente, marca ou modelo */
  term?: string;
  createdFrom?: Date;
  finishedFrom?: Date;
}

/**
 * BUILDER — monta o critério de busca passo a passo, com regras de visibilidade embutidas.
 *
 *   const criteria = WorkOrderCriteriaBuilder.for(auth).withStatus(s).matching(q).build();
 *
 * O controller não precisa saber que cliente só vê as próprias OS: isso nasce no `for(auth)`.
 */
export class WorkOrderCriteriaBuilder {
  private readonly criteria: WorkOrderCriteria;

  private constructor(establishmentId: number) {
    this.criteria = { establishmentId };
  }

  static for(auth: AuthPayload): WorkOrderCriteriaBuilder {
    const builder = new WorkOrderCriteriaBuilder(auth.establishmentId);
    if (!isStaff(auth.role)) builder.criteria.onlyClientId = auth.sub;
    return builder;
  }

  withStatus(status?: OrderStatus | null): this {
    if (status) this.criteria.status = status;
    return this;
  }

  ofClient(clientId?: number | null): this {
    if (clientId) this.criteria.clientId = clientId;
    return this;
  }

  ofVehicle(vehicleId?: number | null): this {
    if (vehicleId) this.criteria.vehicleId = vehicleId;
    return this;
  }

  matching(term?: string | null): this {
    const t = term?.trim();
    if (t) this.criteria.term = t;
    return this;
  }

  createdSince(date: Date): this {
    this.criteria.createdFrom = date;
    return this;
  }

  finishedSince(date: Date): this {
    this.criteria.finishedFrom = date;
    return this;
  }

  /** cópia sem o filtro de status — usada para contar OS por status mantendo a busca */
  withoutStatus(): WorkOrderCriteria {
    const { status, ...rest } = this.criteria;
    return { ...rest };
  }

  build(): WorkOrderCriteria {
    return { ...this.criteria };
  }
}
