import { ForbiddenException, Injectable } from '@nestjs/common';
import { TypeAppointment } from '@prisma/client';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { isStaff } from 'src/shared/utils/role.util';

/** O que a pessoa pode fazer no histórico de UMA OS. Vai junto no detalhe da OS para o front. */
export interface AppointmentPermissions {
  canWrite: boolean;
  canAttach: boolean;
  /** tipos de apontamento permitidos (cliente: só PUBLICO) */
  types: TypeAppointment[];
}

/** a parte da OS que as regras precisam olhar */
export interface AppointmentTarget {
  establishmentId: number;
  clientId: number;
}

/**
 * PORTA — configuração do estabelecimento sobre participação do cliente.
 * O work-order não conhece o módulo de configurações; o adapter liga as duas pontas.
 */
export abstract class ClientParticipationSettings {
  abstract clientAppointmentsEnabled(establishmentId: number): Promise<boolean>;
}

/** STRATEGY — uma regra de escrita por perfil. Novo perfil = nova classe na lista do AppointmentAccess. */
export interface AppointmentAuthorStrategy {
  supports(auth: AuthPayload): boolean;
  permissions(auth: AuthPayload, target: AppointmentTarget): Promise<AppointmentPermissions>;
}

const NONE: AppointmentPermissions = { canWrite: false, canAttach: false, types: [] };

/** equipe (admin, mecânico, super): escreve público e interno, sempre */
export class StaffAuthorStrategy implements AppointmentAuthorStrategy {
  supports(auth: AuthPayload) { return isStaff(auth.role); }

  async permissions(auth: AuthPayload, target: AppointmentTarget): Promise<AppointmentPermissions> {
    if (target.establishmentId !== auth.establishmentId) return NONE;
    return { canWrite: true, canAttach: true, types: [TypeAppointment.PUBLICO, TypeAppointment.INTERNO] };
  }
}

/** cliente: só na própria OS, só público, e só se o estabelecimento liberou */
export class ClientAuthorStrategy implements AppointmentAuthorStrategy {
  constructor(private readonly settings: ClientParticipationSettings) {}

  supports(auth: AuthPayload) { return !isStaff(auth.role); }

  async permissions(auth: AuthPayload, target: AppointmentTarget): Promise<AppointmentPermissions> {
    if (target.establishmentId !== auth.establishmentId || target.clientId !== auth.sub) return NONE;
    if (!(await this.settings.clientAppointmentsEnabled(target.establishmentId))) return NONE;
    return { canWrite: true, canAttach: true, types: [TypeAppointment.PUBLICO] };
  }
}

/** Escolhe a estratégia do perfil da sessão e responde/garante as permissões. */
@Injectable()
export class AppointmentAccess {
  private readonly strategies: AppointmentAuthorStrategy[];

  constructor(settings: ClientParticipationSettings) {
    this.strategies = [new StaffAuthorStrategy(), new ClientAuthorStrategy(settings)];
  }

  permissions(auth: AuthPayload, target: AppointmentTarget): Promise<AppointmentPermissions> {
    const strategy = this.strategies.find(s => s.supports(auth));
    return strategy ? strategy.permissions(auth, target) : Promise.resolve(NONE);
  }

  async assertCanWrite(auth: AuthPayload, target: AppointmentTarget, type: TypeAppointment): Promise<void> {
    const p = await this.permissions(auth, target);
    if (!p.canWrite) throw new ForbiddenException('Este estabelecimento não permite que o cliente escreva na OS.');
    if (!p.types.includes(type)) throw new ForbiddenException('Você só pode registrar apontamentos públicos.');
  }

  async assertCanAttach(auth: AuthPayload, target: AppointmentTarget): Promise<void> {
    const p = await this.permissions(auth, target);
    if (!p.canAttach) throw new ForbiddenException('Você não pode anexar arquivos nesta OS.');
  }
}
