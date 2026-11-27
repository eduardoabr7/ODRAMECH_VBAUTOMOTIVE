// Sobe tudo junto: banco (se necessário) → migrations → assinaturas (:3010) → backend (:3004) → frontend (:4200)
// → painel de licenças (:4300, só se instalado).
// Ctrl+C encerra todos.
import { spawn } from 'node:child_process';
import { ADMIN, BACKEND, FRONTEND, SUBSCRIPTIONS, IS_WIN, color, fail, ok, portInUse, readEnv, run, step, waitForPort, warn } from './lib.mjs';
import { existsSync } from 'node:fs';
import path from 'node:path';

if ([BACKEND, FRONTEND, SUBSCRIPTIONS].some(dir => !existsSync(path.join(dir, 'node_modules')))) {
  fail('Dependências não instaladas. Rode primeiro: setup.bat (ou npm run setup).');
}

const backendEnv = readEnv(path.join(BACKEND, '.env'));
const frontendEnv = readEnv(path.join(FRONTEND, '.env'));
const BACK_PORT = Number(backendEnv.PORT || 3004);
const FRONT_PORT = Number(backendEnv.FRONTEND_PORT || 4200);
const SUBS_PORT = Number(readEnv(path.join(SUBSCRIPTIONS, '.env')).PORT || 3010);
const ADMIN_PORT = 4300;
// o painel é opcional: só sobe se as dependências dele estiverem instaladas
const WITH_ADMIN = existsSync(path.join(ADMIN, 'node_modules'));

if (String(frontendEnv.PORT_BACKEND) !== String(BACK_PORT)) {
  warn(`odramech-frontend/.env aponta para a porta ${frontendEnv.PORT_BACKEND}, mas o backend usa ${BACK_PORT}.`);
}

for (const [port, name] of [[SUBS_PORT, 'assinaturas'], [BACK_PORT, 'backend'], [FRONT_PORT, 'frontend'], ...(WITH_ADMIN ? [[ADMIN_PORT, 'painel de licenças']] : [])]) {
  if (await portInUse(port)) fail(`A porta ${port} (${name}) já está em uso. Feche o processo que está usando ela e tente de novo.`);
}

console.log(`\n${color.orange}${color.bold}  ODRAMECH${color.reset} ${color.dim}— ambiente de desenvolvimento${color.reset}`);

step('Banco de dados');
const { startDatabase } = await import('./db.mjs');
const db = await startDatabase();

step('Aplicando migrations pendentes');
await run('npx', ['prisma', 'migrate', 'deploy'], { cwd: BACKEND });
await run('npx', ['prisma', 'migrate', 'deploy'], { cwd: SUBSCRIPTIONS });

const children = [];
function start(name, tint, cmd, args, cwd) {
  const child = spawn(cmd, args, { cwd, shell: IS_WIN, env: { ...process.env, FORCE_COLOR: '1' } });
  const prefix = `${tint}${name.padEnd(8)}${color.reset}│ `;
  const pipe = stream => {
    let buf = '';
    stream.on('data', d => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const l of lines) if (l.trim()) process.stdout.write(prefix + l + '\n');
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on('exit', code => {
    if (!shuttingDown) console.log(`${prefix}${color.red}encerrado (código ${code})${color.reset}`);
  });
  children.push(child);
  return child;
}

step('Iniciando assinaturas, backend e frontend');
start('assinat.', color.green, 'npm', ['run', 'start:dev'], SUBSCRIPTIONS);
start('backend', color.cyan, 'npm', ['run', 'start:dev'], BACKEND);
start('frontend', color.orange, 'npm', ['start'], FRONTEND);
if (WITH_ADMIN) start('painel', color.yellow, 'npm', ['start'], ADMIN);

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${color.dim}Encerrando…${color.reset}`);
  for (const c of children) {
    try {
      if (IS_WIN) spawn('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
      else c.kill('SIGINT');
    } catch { /* já encerrado */ }
  }
  await db.stop().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const [subsUp, backUp, frontUp] = await Promise.all([waitForPort(SUBS_PORT, 180000), waitForPort(BACK_PORT, 180000), waitForPort(FRONT_PORT, 300000)]);
if (subsUp && backUp && frontUp) {
  console.log(`
${color.green}${color.bold}  Odramech no ar${color.reset}
  App:      ${color.bold}http://localhost:${FRONT_PORT}${color.reset}
  API:      http://localhost:${BACK_PORT}  (saúde: /health)
  Assinat.: http://localhost:${SUBS_PORT}  (saúde: /health)${WITH_ADMIN ? `
  Painel:   http://localhost:${ADMIN_PORT}  (licenças — crie seu acesso: npm --prefix odramech-assinaturas run admin:create -- --email voce@... --totp)` : ''}
  Login:    odramechenterprise@gmail.com / odramin
  ${color.dim}Ctrl+C para encerrar tudo${color.reset}
`);
  if (IS_WIN && !process.env.ODRAMECH_NO_BROWSER) spawn('cmd', ['/c', 'start', '', `http://localhost:${FRONT_PORT}`], { stdio: 'ignore', detached: true });
} else {
  warn('Algum serviço demorou demais para subir — confira as mensagens acima.');
}
