import { Pipe, PipeTransform } from '@angular/core';
import { RoleEnum } from '@shared/enums/role.enum';

@Pipe({ name: 'initials', standalone: true })
export class InitialsPipe implements PipeTransform {
  transform(name?: string | null): string {
    if (!name) return '·';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }
}

@Pipe({ name: 'relativeTime', standalone: true })
export class RelativeTimePipe implements PipeTransform {
  private readonly rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

  transform(value?: string | Date | null): string {
    if (!value) return '—';
    const date = new Date(value);
    const diff = (date.getTime() - Date.now()) / 1000;
    const abs = Math.abs(diff);

    if (abs < 60) return 'agora';
    if (abs < 3600) return this.rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return this.rtf.format(Math.round(diff / 3600), 'hour');
    if (abs < 86400 * 7) return this.rtf.format(Math.round(diff / 86400), 'day');

    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: abs > 86400 * 300 ? 'numeric' : undefined });
  }
}

@Pipe({ name: 'phone', standalone: true })
export class PhonePipe implements PipeTransform {
  transform(value?: string | null): string {
    if (!value) return '—';
    const d = value.replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return value;
  }
}

@Pipe({ name: 'plate', standalone: true })
export class PlatePipe implements PipeTransform {
  transform(value?: string | null): string {
    if (!value) return '—';
    const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // padrão antigo AAA9999 → AAA-9999 ; Mercosul AAA9A99 fica sem hífen
    return /^[A-Z]{3}\d{4}$/.test(raw) ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw;
  }
}

const ROLE_LABEL: Record<string, string> = {
  [RoleEnum.ADMIN]: 'Administrador',
  [RoleEnum.WORKER]: 'Mecânico',
  [RoleEnum.USER]: 'Cliente',
  [RoleEnum.SUPERUSER]: 'Super usuário',
};

@Pipe({ name: 'roleLabel', standalone: true })
export class RoleLabelPipe implements PipeTransform {
  transform(role?: string | null): string {
    return role ? ROLE_LABEL[role] ?? role : '—';
  }
}

export const UI_PIPES = [InitialsPipe, RelativeTimePipe, PhonePipe, PlatePipe, RoleLabelPipe] as const;
