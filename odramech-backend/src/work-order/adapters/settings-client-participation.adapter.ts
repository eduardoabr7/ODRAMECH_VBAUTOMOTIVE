import { Injectable } from '@nestjs/common';
import { SettingsService } from 'src/settings/services/settings.service';
import { ClientParticipationSettings } from '../domain/appointment-access';

/** ADAPTER — responde a porta do work-order com as configurações do estabelecimento. */
@Injectable()
export class SettingsClientParticipation extends ClientParticipationSettings {
  constructor(private readonly settings: SettingsService) { super(); }

  async clientAppointmentsEnabled(establishmentId: number): Promise<boolean> {
    return (await this.settings.workOrderSettings(establishmentId)).clientAppointmentsEnabled;
  }
}
