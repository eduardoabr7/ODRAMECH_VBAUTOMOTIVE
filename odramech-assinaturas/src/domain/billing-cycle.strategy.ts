import { BillingInterval } from './model';

/**
 * STRATEGY — cálculo de período por tipo de ciclo.
 *
 * O serviço de assinaturas pergunta "quando termina um período que começa em X?"
 * sem saber se é mensal ou anual. Um ciclo novo (trimestral, semestral) é uma classe
 * nova registrada no mapa — nenhum `if (interval === ...)` espalhado (Open/Closed).
 */
export interface BillingCycleStrategy {
  readonly interval: BillingInterval;
  readonly label: string;
  /** fim (exclusivo) do período que começa em `start` */
  periodEnd(start: Date): Date;
  /** meses equivalentes — usado para mostrar preço mensal equivalente */
  readonly months: number;
}

/** Soma meses preservando o dia; se o mês destino for menor (31 → fev), usa o último dia. */
export function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export class MonthlyCycle implements BillingCycleStrategy {
  readonly interval = 'MONTHLY' as const;
  readonly label = 'Mensal';
  readonly months = 1;
  periodEnd(start: Date): Date {
    return addMonthsClamped(start, 1);
  }
}

export class YearlyCycle implements BillingCycleStrategy {
  readonly interval = 'YEARLY' as const;
  readonly label = 'Anual';
  readonly months = 12;
  periodEnd(start: Date): Date {
    return addMonthsClamped(start, 12);
  }
}

const CYCLES: Record<BillingInterval, BillingCycleStrategy> = {
  MONTHLY: new MonthlyCycle(),
  YEARLY: new YearlyCycle(),
};

export function cycleFor(interval: BillingInterval): BillingCycleStrategy {
  const cycle = CYCLES[interval];
  if (!cycle) throw new Error(`Ciclo de cobrança desconhecido: ${interval}`);
  return cycle;
}
