import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

/**
 * Planos padrão. Valores em centavos — ajuste aqui e rode `npm run seed` de novo
 * (idempotente: atualiza preço/nome dos planos existentes pelo código).
 */
const PLANS = [
  {
    code: 'MENSAL',
    name: 'Odramech Mensal',
    interval: 'MONTHLY' as const,
    priceCents: 14990,
    description: 'Todos os recursos, cobrança mês a mês. Cancele quando quiser.',
    sortOrder: 1,
  },
  {
    code: 'ANUAL',
    name: 'Odramech Anual',
    interval: 'YEARLY' as const,
    priceCents: 143880, // 12 × R$ 119,90 — 20% de desconto sobre o mensal
    description: 'Todos os recursos, pagamento único por ano com 20% de desconto.',
    sortOrder: 2,
  },
];

async function main() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: { name: plan.name, priceCents: plan.priceCents, description: plan.description, sortOrder: plan.sortOrder, active: true },
      create: plan,
    });
  }
  console.log(`✅ ${PLANS.length} planos de assinatura prontos`);
}

main()
  .catch(e => { console.error('❌ Seed de assinaturas falhou:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
