/**
 * Cria/atualiza um administrador do painel de assinaturas (odramech-admin).
 * Só existe por linha de comando, de propósito: não há tela nem API para criar administradores.
 *
 *   npm run admin:create -- --email voce@dominio.com --name "Seu Nome" [--totp]
 *   npm run admin:create -- --email voce@dominio.com --reset-password
 *   npm run admin:create -- --email voce@dominio.com --totp          (ativa/troca o 2FA)
 *   npm run admin:create -- --email voce@dominio.com --disable
 *
 * A senha é pedida no terminal (não fica no histórico do shell). Para automação: ADMIN_PASSWORD=...
 */
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as readline from 'node:readline';
import { hashPassword, newTotpSecret, totpUri } from '../src/admin/crypto';

dotenv.config();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function ask(question: string, hidden: boolean): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
      out._writeToOutput = (s: string) => { if (s.includes(question)) out.output.write(s); else out.output.write('*'); };
    }
    rl.question(question, answer => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer); });
  });
}

function strongEnough(pw: string): string | null {
  if (pw.length < 12) return 'mínimo de 12 caracteres';
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) return 'use letras maiúsculas, minúsculas e números';
  return null;
}

async function askPassword(): Promise<string> {
  if (process.env.ADMIN_PASSWORD) {
    const problem = strongEnough(process.env.ADMIN_PASSWORD);
    if (problem) throw new Error(`ADMIN_PASSWORD fraca: ${problem}`);
    return process.env.ADMIN_PASSWORD;
  }
  for (;;) {
    const pw = await ask('Senha do administrador: ', true);
    const problem = strongEnough(pw);
    if (problem) { console.log(`  ✗ ${problem}`); continue; }
    if ((await ask('Repita a senha: ', true)) !== pw) { console.log('  ✗ as senhas não conferem'); continue; }
    return pw;
  }
}

async function main() {
  const email = arg('email')?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.log('Uso: npm run admin:create -- --email voce@dominio.com --name "Seu Nome" [--totp]');
    process.exitCode = 1;
    return;
  }
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.adminUser.findUnique({ where: { email } });

    if (flag('disable')) {
      if (!existing) throw new Error('Administrador não encontrado.');
      await prisma.$transaction([
        prisma.adminUser.update({ where: { email }, data: { active: false } }),
        prisma.adminSession.deleteMany({ where: { adminId: existing.id } }),
      ]);
      console.log(`✅ ${email} desativado e sessões encerradas.`);
      return;
    }

    const data: { name?: string; passwordHash?: string; totpSecret?: string; active?: boolean } = { active: true };
    if (arg('name')) data.name = arg('name');
    if (!existing || flag('reset-password')) data.passwordHash = await hashPassword(await askPassword());
    if (flag('totp')) data.totpSecret = newTotpSecret();

    if (existing) {
      await prisma.adminUser.update({ where: { email }, data });
      // trocou senha ou 2FA: derruba as sessões abertas
      if (data.passwordHash || data.totpSecret) await prisma.adminSession.deleteMany({ where: { adminId: existing.id } });
      console.log(`✅ Administrador ${email} atualizado.`);
    } else {
      await prisma.adminUser.create({ data: { email, name: data.name ?? email.split('@')[0], passwordHash: data.passwordHash!, totpSecret: data.totpSecret ?? null } });
      console.log(`✅ Administrador ${email} criado.`);
    }

    if (data.totpSecret) {
      console.log('\n🔐 2FA ativado. No app autenticador (Google Authenticator, Authy, 1Password…) adicione a conta:');
      console.log(`   Chave (digitar à mão): ${data.totpSecret}`);
      console.log(`   Ou o link: ${totpUri(data.totpSecret, email)}`);
      console.log('   A partir de agora o login no painel pede o código de 6 dígitos.');
    } else if (!existing) {
      console.log('\n⚠️  Recomendado: ative o 2FA com  npm run admin:create -- --email ' + email + ' --totp');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error('❌', err.message ?? err); process.exitCode = 1; });
