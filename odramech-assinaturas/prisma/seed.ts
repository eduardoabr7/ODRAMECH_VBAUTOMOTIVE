import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

/** Recursos que dependem do plano (o backend da oficina libera/bloqueia por estes códigos). */
const QUOTE_DOCUMENT_EDITOR = 'QUOTE_DOCUMENT_EDITOR'; // editar cabeçalho/corpo/rodapé do orçamento (HTML)
const LOGIN_CUSTOMIZATION = 'LOGIN_CUSTOMIZATION';     // imagem e textos próprios na tela de login

/**
 * Planos padrão (todos mensais). Valores em centavos — ajuste aqui e rode `npm run seed` de novo
 * (idempotente: atualiza os planos existentes pelo código).
 */
const PLANS = [
  {
    code: 'BASIC',
    name: 'Basic',
    interval: 'MONTHLY' as const,
    priceCents: 22990,
    tier: 1,
    maxEstablishments: 1,
    features: [] as string[],
    description: '1 estabelecimento. OS, orçamentos, clientes, veículos e financeiro.',
    sortOrder: 1,
  },
  {
    code: 'INTERMEDIARIO',
    name: 'Intermediário',
    interval: 'MONTHLY' as const,
    priceCents: 42500,
    tier: 2,
    maxEstablishments: 3,
    features: [QUOTE_DOCUMENT_EDITOR, LOGIN_CUSTOMIZATION],
    description: 'Até 3 estabelecimentos. Documento de orçamento personalizado e tela de login com a sua marca.',
    sortOrder: 2,
  },
  {
    code: 'PRO',
    name: 'Pro',
    interval: 'MONTHLY' as const,
    priceCents: 79900,
    tier: 3,
    maxEstablishments: 5,
    features: [QUOTE_DOCUMENT_EDITOR, LOGIN_CUSTOMIZATION],
    description: 'Até 5 estabelecimentos. Tudo do Intermediário.',
    sortOrder: 3,
  },
  {
    code: 'ULTRA',
    name: 'Ultra',
    interval: 'MONTHLY' as const,
    priceCents: 239900,
    tier: 4,
    maxEstablishments: null,
    features: [QUOTE_DOCUMENT_EDITOR, LOGIN_CUSTOMIZATION],
    description: '10+ estabelecimentos (sem limite). Tudo do Pro.',
    sortOrder: 4,
  },
];

/**
 * Planos antigos (Mensal/Anual) — desativados. Assinaturas pagas neles migram para o Basic
 * (preço mais próximo); quem ainda está no teste grátis migra para o plano do teste.
 */
const LEGACY_TO_NEW: Record<string, string> = { MENSAL: 'BASIC', ANUAL: 'BASIC' };
const TRIAL_PLAN = process.env.DEFAULT_PLAN_CODE || 'INTERMEDIARIO';

async function main() {
  for (const plan of PLANS) {
    const { code, ...data } = plan;
    await prisma.plan.upsert({
      where: { code },
      update: { ...data, active: true },
      create: plan,
    });
  }

  for (const [legacy, target] of Object.entries(LEGACY_TO_NEW)) {
    const old = await prisma.plan.findUnique({ where: { code: legacy } });
    if (!old) continue;
    const next = await prisma.plan.findUniqueOrThrow({ where: { code: target } });
    const trial = await prisma.plan.findUniqueOrThrow({ where: { code: TRIAL_PLAN } });
    const trialing = await prisma.subscription.updateMany({ where: { planId: old.id, status: 'TRIALING' }, data: { planId: trial.id } });
    const moved = await prisma.subscription.updateMany({ where: { planId: old.id }, data: { planId: next.id } });
    if (trialing.count) console.log(`↪ ${trialing.count} assinatura(s) em teste do plano ${legacy} migradas para ${TRIAL_PLAN}`);
    // faturas em aberto do plano antigo são anuladas: a próxima é gerada já no plano novo
    await prisma.invoice.updateMany({ where: { planCode: legacy, status: 'OPEN' }, data: { status: 'VOID' } });
    await prisma.plan.update({ where: { id: old.id }, data: { active: false } });
    if (moved.count) console.log(`↪ ${moved.count} assinatura(s) do plano ${legacy} migradas para ${target}`);
  }

  console.log(`✅ ${PLANS.length} planos de assinatura prontos`);
}

main()
  .catch(e => { console.error('❌ Seed de assinaturas falhou:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
