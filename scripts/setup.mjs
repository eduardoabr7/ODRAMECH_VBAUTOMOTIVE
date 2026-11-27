// Prepara o projeto do zero numa máquina Windows (ou qualquer outra):
//   1. confere o Node
//   2. cria os .env a partir dos exemplos, se não existirem
//   3. instala dependências (raiz, backend, frontend)
//   4. roda os scripts de instalação que o npm 11 bloqueia (bcrypt, prisma, embedded-postgres)
//   5. sobe o banco, aplica migrations, gera o Prisma Client e roda o seed (oficina + assinaturas)
import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { BACKEND, FRONTEND, ROOT, SUBSCRIPTIONS, fail, ok, run, step, warn, color } from './lib.mjs';

const NPM = 'npm';
const NPX = 'npx';

console.log(`\n${color.orange}${color.bold}  ODRAMECH${color.reset} ${color.dim}— preparando ambiente${color.reset}`);

// 1. Node
step('Verificando Node.js');
const major = Number(process.versions.node.split('.')[0]);
if (major < 18) fail(`Node ${process.versions.node} é antigo demais. Instale o Node 20 ou 22 LTS: https://nodejs.org`);
if (major > 22) warn(`Node ${process.versions.node}: o Angular 19 recomenda Node 18–22. Deve funcionar, mas se algo falhar use o Node 22 LTS.`);
ok(`Node ${process.versions.node}`);

// 2. .env
step('Arquivos .env');
for (const dir of [BACKEND, FRONTEND, SUBSCRIPTIONS]) {
  const env = path.join(dir, '.env');
  const example = path.join(dir, '.env.example');
  if (existsSync(env)) ok(`${path.basename(dir)}/.env encontrado`);
  else if (existsSync(example)) { copyFileSync(example, env); warn(`${path.basename(dir)}/.env criado a partir do .env.example — revise os valores.`); }
  else fail(`${path.basename(dir)}/.env não encontrado.`);
}

// 3. Dependências
step('Instalando dependências (pode demorar alguns minutos na primeira vez)');
await run(NPM, ['install', '--no-audit', '--no-fund'], { cwd: ROOT });
ok('raiz');
await run(NPM, ['install', '--no-audit', '--no-fund'], { cwd: BACKEND });
ok('backend');
// o ng-select declara peer do Angular 20; o lockfile resolve com Angular 19
await run(NPM, ['install', '--no-audit', '--no-fund', '--legacy-peer-deps'], { cwd: FRONTEND });
ok('frontend');
await run(NPM, ['install', '--no-audit', '--no-fund'], { cwd: SUBSCRIPTIONS });
ok('assinaturas');

// 4. Scripts nativos bloqueados pelo npm 11 (allowScripts)
step('Compilando dependências nativas');
await run(NPM, ['rebuild', '@embedded-postgres/windows-x64', '--if-present'], { cwd: ROOT }).catch(() => {});
await run(NPM, ['rebuild', 'bcrypt', '@prisma/engines', 'prisma', '@prisma/client', '@swc/core'], { cwd: BACKEND });
await run(NPM, ['rebuild', '@prisma/engines', 'prisma', '@prisma/client'], { cwd: SUBSCRIPTIONS });
ok('bcrypt, prisma, swc');

// 5. Banco
step('Banco de dados');
const { startDatabase } = await import('./db.mjs');
const db = await startDatabase();
try {
  await run(NPX, ['prisma', 'migrate', 'deploy'], { cwd: BACKEND });
  ok('migrations aplicadas');
  await run(NPX, ['prisma', 'generate'], { cwd: BACKEND });
  ok('Prisma Client gerado');
  await run(NPX, ['ts-node', 'prisma/seed.ts'], { cwd: BACKEND });
  ok('seed aplicado');

  step('Serviço de assinaturas');
  await run(NPX, ['prisma', 'migrate', 'deploy'], { cwd: SUBSCRIPTIONS });
  await run(NPX, ['prisma', 'generate'], { cwd: SUBSCRIPTIONS });
  await run(NPX, ['ts-node', 'prisma/seed.ts'], { cwd: SUBSCRIPTIONS });
  ok('banco de assinaturas e planos prontos');
} finally {
  await db.stop();
}

console.log(`
${color.green}${color.bold}  Tudo pronto!${color.reset}

  Para iniciar:   ${color.bold}iniciar.bat${color.reset}   (ou: npm run dev)
  Abrir:          http://localhost:4200
  Assinaturas:    http://localhost:3010/health
  Login inicial:  odramechenterprise@gmail.com  /  odramin
`);
