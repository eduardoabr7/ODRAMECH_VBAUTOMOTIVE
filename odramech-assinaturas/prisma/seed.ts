import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

// códigos de recurso que o backend da oficina confere
const QUOTE_DOCUMENT_EDITOR = 'QUOTE_DOCUMENT_EDITOR'; // editar cabeçalho/corpo/rodapé do orçamento (HTML)
const LOGIN_CUSTOMIZATION = 'LOGIN_CUSTOMIZATION';     // imagem e textos próprios na tela de login

/**
 // valores em centavos. Pode rodar o seed de novo, ele atualiza os planos pelo código
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

// planos antigos (mensal/anual): quem pagava vai pro Basic, quem está no teste vai pro plano do teste
const LEGACY_TO_NEW: Record<string, string> = { MENSAL: 'BASIC', ANUAL: 'BASIC' };
const TRIAL_PLAN = process.env.DEFAULT_PLAN_CODE || 'INTERMEDIARIO';

async function main() {
  // só CRIA os planos que faltam: depois de criados, preço/recursos são editados no painel
  // administrativo (odramech-admin) e rodar o seed de novo não desfaz essas edições.
  // Para forçar os valores deste arquivo: SEED_OVERWRITE_PLANS=true
  const overwrite = process.env.SEED_OVERWRITE_PLANS === 'true';
  for (const plan of PLANS) {
    const { code, ...data } = plan;
    await prisma.plan.upsert({
      where: { code },
      update: overwrite ? { ...data, active: true } : {},
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
