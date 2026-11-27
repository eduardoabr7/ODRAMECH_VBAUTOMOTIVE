import { round, summarizeMoney } from 'src/shared/utils/money.util';
import { PaymentRepository, ReviewRepository } from '../repositories/billing.repositories';

export interface FinancialReport {
  revenueToday: number;
  revenueMonth: number;
  receivable: number;
  ratingAvg: number | null;
  ratingCount: number;
  generatedAt: string;
}

/**
 * BUILDER — monta o relatório financeiro por partes. Cada etapa é opcional e as consultas
 * só rodam no `build()`, em paralelo:
 *
 *   await new FinancialReportBuilder(payments, reviews, scope)
 *     .withRevenue()
 *     .withReceivables()
 *     .withRatings()
 *     .build();
 *
 * Telas diferentes pedem só o que usam (o dashboard pede tudo; um widget pode pedir só a receita).
 */
export class FinancialReportBuilder {
  private readonly tasks: Promise<void>[] = [];
  private readonly report: FinancialReport = {
    revenueToday: 0,
    revenueMonth: 0,
    receivable: 0,
    ratingAvg: null,
    ratingCount: 0,
    generatedAt: '',
  };

  constructor(
    private readonly payments: PaymentRepository,
    private readonly reviews: ReviewRepository,
    private readonly scope: { establishmentId: number; onlyClientId?: number },
    private readonly now: Date = new Date(),
  ) {}

  withRevenue(): this {
    const startOfDay = new Date(this.now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay);
    startOfMonth.setDate(1);

    this.tasks.push((async () => {
      const [today, month] = await Promise.all([
        this.payments.sumPaid(this.scope.establishmentId, startOfDay, this.scope.onlyClientId),
        this.payments.sumPaid(this.scope.establishmentId, startOfMonth, this.scope.onlyClientId),
      ]);
      this.report.revenueToday = today;
      this.report.revenueMonth = month;
    })());
    return this;
  }

  withReceivables(): this {
    this.tasks.push((async () => {
      const finished = await this.payments.finishedWithMoney(this.scope.establishmentId, this.scope.onlyClientId);
      this.report.receivable = round(finished.reduce((acc, wo) => acc + Math.max(0, summarizeMoney(wo.items, wo.payments).balance), 0));
    })());
    return this;
  }

  withRatings(): this {
    this.tasks.push((async () => {
      const { avg, count } = await this.reviews.average(this.scope.establishmentId, this.scope.onlyClientId);
      this.report.ratingAvg = avg ? round(avg) : null;
      this.report.ratingCount = count;
    })());
    return this;
  }

  async build(): Promise<FinancialReport> {
    await Promise.all(this.tasks);
    return { ...this.report, generatedAt: this.now.toISOString() };
  }
}
