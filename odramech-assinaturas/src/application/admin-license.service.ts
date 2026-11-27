import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { decideAccess } from '../domain/access-policy';
import { cycleFor } from '../domain/billing-cycle.strategy';
import { complimentaryActive, entitlementsOf, NewSubscription, Plan, Subscription, SubscriptionStatus } from '../domain/model';
import { SubscriptionFactory } from '../domain/subscription.factory';
import { SubscriptionChanged, SubscriptionEventPublisher } from '../events/subscription-events';
import { EventLogRepository, InvoiceRepository, PlanChanges, PlanRepository, SubscriptionRepository } from '../repositories/repositories';
import { Clock } from './clock';
import { EnterpriseDirectory } from './enterprise-directory';
import { SubscriptionService } from './subscription.service';

/** "sem prazo": a cortesia sem data de fim usa um fim de período bem distante */
export const FOREVER = new Date('2999-12-31T23:59:59.000Z');

export interface AdminLicenseSettings {
  trialDays: number;
  graceDays: number;
  defaultPlanCode: string;
}

/** quem executou a ação no painel (vai para a auditoria) */
export interface AdminActor {
  id: number;
  email: string;
}

const actorLabel = (a: AdminActor) => `admin:${a.id} ${a.email}`;

/**
 * Casos de uso do PAINEL ADMINISTRATIVO (dono do sistema).
 * Tudo aqui passa por cima das regras de autoatendimento — por isso:
 *  - só é exposto em rotas que exigem sessão de administrador;
 *  - TODA ação publica um evento com o autor (trilha de auditoria + aviso ao backend para limpar o cache).
 */
export class AdminLicenseService {
  constructor(
    private readonly plans: PlanRepository,
    private readonly subs: SubscriptionRepository,
    private readonly invoices: InvoiceRepository,
    private readonly eventLog: EventLogRepository,
    private readonly events: SubscriptionEventPublisher,
    private readonly billing: SubscriptionService,
    private readonly directory: EnterpriseDirectory,
    private readonly clock: Clock,
    private readonly settings: AdminLicenseSettings,
  ) {}

  // ═══ Consultas ══════════════════════════════════════════
  async dashboard() {
    const [subs, plans, recent] = await Promise.all([this.subs.listAll(), this.plans.listAll(), this.eventLog.listRecent(25)]);
    const byId = new Map(plans.map(p => [p.id, p] as const));
    const now = this.clock.now();
    const counts = { total: subs.length, trial: 0, active: 0, complimentary: 0, grace: 0, blocked: 0, suspended: 0 };
    let mrrCents = 0;
    for (const s of subs) {
      const access = decideAccess(s, this.settings.graceDays, now);
      if (s.suspended) counts.suspended++;
      else if (complimentaryActive(s, now)) counts.complimentary++;
      else if (access.level === 'blocked') counts.blocked++;
      else if (access.level === 'grace') counts.grace++;
      else if (s.status === 'TRIALING') counts.trial++;
      else counts.active++;

      const plan = byId.get(s.planId);
      if (plan && s.status === 'ACTIVE' && !s.complimentary && !s.suspended) mrrCents += Math.round(plan.priceCents / cycleFor(plan.interval).months);
    }
    const subById = new Map(subs.map(s => [s.id, s] as const));
    return {
      counts,
      mrrCents,
      recentEvents: recent.map(e => ({ ...e, enterpriseId: subById.get(e.subscriptionId)?.enterpriseId ?? null, enterpriseName: subById.get(e.subscriptionId)?.enterpriseName ?? null })),
    };
  }

  /** assinaturas + empresas da oficina que ainda não têm assinatura */
  async list() {
    const [subs, plans, directory] = await Promise.all([this.subs.listAll(), this.plans.listAll(), this.directory.list()]);
    const byPlan = new Map(plans.map(p => [p.id, p] as const));
    const byEnterprise = new Map((directory ?? []).map(e => [e.id, e] as const));
    const now = this.clock.now();

    const rows = subs.map(s => this.row(s, byPlan.get(s.planId) ?? null, byEnterprise.get(s.enterpriseId) ?? null, now));
    const withSub = new Set(subs.map(s => s.enterpriseId));
    const withoutSub = (directory ?? []).filter(e => !withSub.has(e.id)).map(e => ({
      enterpriseId: e.id, enterpriseName: e.name, cnpj: e.cnpj, email: e.email, subscription: null, plan: null, access: null, kind: 'none' as const,
    }));
    return { directoryAvailable: directory !== null, licenses: [...rows, ...withoutSub] };
  }

  async detail(enterpriseId: number) {
    const sub = await this.mustFind(enterpriseId);
    const [plan, invoices, events, directory] = await Promise.all([
      this.plans.findById(sub.planId),
      this.invoices.listBySubscription(sub.id, 50),
      this.eventLog.listBySubscription(sub.id, 100),
      this.directory.list(),
    ]);
    const enterprise = directory?.find(e => e.id === enterpriseId) ?? null;
    return { ...this.row(sub, plan, enterprise, this.clock.now()), enterprise, invoices, events };
  }

  // ═══ Licenças ═══════════════════════════════════════════
  /** cria (ou recomeça) um teste grátis — útil para quem ainda não tem assinatura */
  async startTrial(actor: AdminActor, enterpriseId: number, enterpriseName: string | null, days: number | null) {
    const now = this.clock.now();
    const plan = await this.planOrThrow(this.settings.defaultPlanCode);
    const fresh = SubscriptionFactory.trial(enterpriseId, enterpriseName, plan, days ?? this.settings.trialDays, now);
    const existing = await this.subs.findByEnterprise(enterpriseId);
    if (existing) await this.voidOpenInvoices(existing.id);
    const sub = existing
      ? await this.subs.update(existing.id, { ...fresh, enterpriseName: enterpriseName ?? existing.enterpriseName, adminNote: existing.adminNote })
      : await this.subs.create(fresh);
    await this.emit(actor, sub, existing ? 'license.period_changed' : 'license.created', { mode: 'trial', until: sub.currentPeriodEnd, planCode: plan.code });
    return this.detail(enterpriseId);
  }

  /** licença cortesia: sem cobrança, no plano escolhido, com ou sem prazo */
  async grantComplimentary(actor: AdminActor, enterpriseId: number, input: { planCode: string; until: Date | null; enterpriseName?: string | null; note?: string | null }) {
    const now = this.clock.now();
    if (input.until && input.until <= now) throw new BadRequestException('A data final precisa ser no futuro.');
    const plan = await this.planOrThrow(input.planCode);

    const data: Partial<NewSubscription> = {
      planId: plan.id,
      status: 'ACTIVE',
      complimentary: true,
      complimentaryUntil: input.until,
      currentPeriodStart: now,
      currentPeriodEnd: input.until ?? FOREVER,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      ...(input.note !== undefined && { adminNote: input.note }),
    };

    let sub = await this.subs.findByEnterprise(enterpriseId);
    const created = !sub;
    if (sub) {
      await this.voidOpenInvoices(sub.id);
      sub = await this.subs.update(sub.id, data);
    } else {
      const base = SubscriptionFactory.trial(enterpriseId, input.enterpriseName ?? null, plan, 0, now);
      sub = await this.subs.create({ ...base, ...data } as NewSubscription);
    }
    await this.emit(actor, sub, created ? 'license.created' : 'license.complimentary_granted', { mode: 'complimentary', planCode: plan.code, until: input.until });
    return this.detail(enterpriseId);
  }

  /** encerra a cortesia agora: a empresa fica bloqueada até assinar */
  async revokeComplimentary(actor: AdminActor, enterpriseId: number) {
    const sub = await this.mustFind(enterpriseId);
    if (!sub.complimentary) throw new ConflictException('Esta licença não é cortesia.');
    const now = this.clock.now();
    const updated = await this.subs.update(sub.id, { complimentary: false, complimentaryUntil: null, status: 'EXPIRED', currentPeriodEnd: now });
    await this.emit(actor, updated, 'license.complimentary_revoked');
    return this.detail(enterpriseId);
  }

  /** troca o plano na hora, sem fatura (decisão do administrador) */
  async changePlan(actor: AdminActor, enterpriseId: number, planCode: string) {
    const sub = await this.mustFind(enterpriseId);
    const plan = await this.planOrThrow(planCode);
    const previous = await this.plans.findById(sub.planId);
    const updated = await this.subs.update(sub.id, { planId: plan.id });
    await this.emit(actor, updated, 'license.plan_changed', { planCode: plan.code, previousPlanCode: previous?.code });
    return this.detail(enterpriseId);
  }

  /** define o fim do período atual (estender teste, dar dias extras, encerrar antes) */
  async setPeriodEnd(actor: AdminActor, enterpriseId: number, until: Date, status?: Extract<SubscriptionStatus, 'TRIALING' | 'ACTIVE'>) {
    const sub = await this.mustFind(enterpriseId);
    if (sub.complimentary) throw new ConflictException('Licença cortesia: altere o prazo pela própria cortesia.');
    const now = this.clock.now();
    const reopen = until > now && (sub.status === 'EXPIRED' || sub.status === 'CANCELED' || sub.status === 'PAST_DUE');
    // reabrir sem dizer o status: volta como teste se nunca pagou, senão como ativa
    const neverPaid = !(await this.invoices.listBySubscription(sub.id, 50)).some(i => i.status === 'PAID');
    const nextStatus: SubscriptionStatus = status ?? (reopen ? (neverPaid ? 'TRIALING' : 'ACTIVE') : sub.status);
    const updated = await this.subs.update(sub.id, {
      currentPeriodEnd: until,
      status: nextStatus,
      ...(nextStatus === 'TRIALING' && { trialEndsAt: until }),
      ...(reopen && { canceledAt: null, cancelAtPeriodEnd: false }),
    });
    await this.emit(actor, updated, 'license.period_changed', { until, previousUntil: sub.currentPeriodEnd, status: nextStatus, previousStatus: sub.status });
    return this.detail(enterpriseId);
  }

  async suspend(actor: AdminActor, enterpriseId: number, reason: string | null) {
    const sub = await this.mustFind(enterpriseId);
    const updated = await this.subs.update(sub.id, { suspended: true, suspendedReason: reason });
    await this.emit(actor, updated, 'license.suspended', { reason });
    return this.detail(enterpriseId);
  }

  async unsuspend(actor: AdminActor, enterpriseId: number) {
    const sub = await this.mustFind(enterpriseId);
    const updated = await this.subs.update(sub.id, { suspended: false, suspendedReason: null });
    await this.emit(actor, updated, 'license.unsuspended');
    return this.detail(enterpriseId);
  }

  async setNote(actor: AdminActor, enterpriseId: number, note: string | null) {
    const sub = await this.mustFind(enterpriseId);
    const updated = await this.subs.update(sub.id, { adminNote: note });
    await this.emit(actor, updated, 'license.note_changed');
    return this.detail(enterpriseId);
  }

  // ═══ Faturas ════════════════════════════════════════════
  /** pagamento recebido por fora (transferência, dinheiro…) */
  async markInvoicePaid(actor: AdminActor, invoiceId: string) {
    const invoice = await this.invoices.findById(invoiceId);
    if (!invoice) throw new NotFoundException('Fatura não encontrada.');
    if (invoice.status !== 'OPEN') throw new ConflictException('Esta fatura não está em aberto.');
    await this.billing.markInvoicePaid(invoice, actorLabel(actor));
    const sub = await this.subs.findById(invoice.subscriptionId);
    return sub ? this.detail(sub.enterpriseId) : null;
  }

  async voidInvoice(actor: AdminActor, invoiceId: string) {
    const invoice = await this.invoices.findById(invoiceId);
    if (!invoice) throw new NotFoundException('Fatura não encontrada.');
    if (invoice.status !== 'OPEN') throw new ConflictException('Só faturas em aberto podem ser anuladas.');
    await this.invoices.update(invoice.id, { status: 'VOID' });
    const sub = await this.subs.findById(invoice.subscriptionId);
    if (!sub) return null;
    await this.emit(actor, sub, 'invoice.voided', { invoiceId });
    return this.detail(sub.enterpriseId);
  }

  // ═══ Planos ═════════════════════════════════════════════
  listPlans() {
    return this.plans.listAll();
  }

  /** preço novo vale para as PRÓXIMAS faturas; as já emitidas não mudam */
  async updatePlan(id: number, changes: PlanChanges) {
    const plan = await this.plans.findById(id);
    if (!plan) throw new NotFoundException('Plano não encontrado.');
    if (changes.active === false && plan.code === this.settings.defaultPlanCode) {
      throw new ConflictException('Este é o plano do teste grátis; troque DEFAULT_PLAN_CODE antes de desativá-lo.');
    }
    return this.plans.update(id, changes);
  }

  async createPlan(data: Omit<Plan, 'id'>) {
    if (await this.plans.findByCode(data.code)) throw new ConflictException('Já existe um plano com esse código.');
    return this.plans.create(data);
  }

  runLifecycle() {
    return this.billing.processLifecycle();
  }

  // ═══ Internos ═══════════════════════════════════════════
  private row(sub: Subscription, plan: Plan | null, enterprise: { name: string; cnpj: string; email: string } | null, now: Date) {
    const access = decideAccess(sub, this.settings.graceDays, now);
    const kind = sub.suspended ? 'suspended' : complimentaryActive(sub, now) ? 'complimentary' : sub.status === 'TRIALING' ? 'trial' : 'paid';
    return {
      enterpriseId: sub.enterpriseId,
      enterpriseName: enterprise?.name ?? sub.enterpriseName,
      cnpj: enterprise?.cnpj ?? null,
      email: enterprise?.email ?? null,
      subscription: { ...sub, foreverComplimentary: sub.complimentary && !sub.complimentaryUntil },
      plan: plan ? { ...entitlementsOf(plan), priceCents: plan.priceCents } : null,
      access,
      kind,
    };
  }

  private async mustFind(enterpriseId: number) {
    const sub = await this.subs.findByEnterprise(enterpriseId);
    if (!sub) throw new NotFoundException('Esta empresa ainda não tem licença.');
    return sub;
  }

  private async planOrThrow(code: string) {
    const plan = await this.plans.findByCode(code);
    if (!plan) throw new NotFoundException('Plano não encontrado.');
    return plan;
  }

  private async voidOpenInvoices(subscriptionId: string) {
    const open = await this.invoices.findOpen(subscriptionId);
    if (open) await this.invoices.update(open.id, { status: 'VOID' });
  }

  private emit(actor: AdminActor, sub: Subscription, type: SubscriptionChanged['type'], data?: Record<string, unknown>) {
    return this.events.publish({ type, actor: actorLabel(actor), subscriptionId: sub.id, enterpriseId: sub.enterpriseId, status: sub.status, data });
  }
}
