// Utilitários compartilhados pelos scripts de ambiente.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BACKEND = path.join(ROOT, 'odramech-backend');
export const FRONTEND = path.join(ROOT, 'odramech-frontend');
export const SUBSCRIPTIONS = path.join(ROOT, 'odramech-assinaturas');
export const ADMIN = path.join(ROOT, 'odramech-admin');
export const IS_WIN = process.platform === 'win32';

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', orange: '\x1b[38;5;208m' };
export const color = C;

export function step(msg) { console.log(`\n${C.orange}▸${C.reset} ${C.bold}${msg}${C.reset}`); }
export function ok(msg) { console.log(`  ${C.green}✓${C.reset} ${msg}`); }
export function warn(msg) { console.log(`  ${C.yellow}!${C.reset} ${msg}`); }
export function fail(msg) { console.error(`\n${C.red}✗ ${msg}${C.reset}\n`); process.exit(1); }

/** Executa um comando e espera terminar (herda o terminal). */
export function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: IS_WIN, ...opts });
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} saiu com código ${code}`)));
    child.on('error', reject);
  });
}

/** Lê um arquivo .env simples (KEY=VALUE). */
export function readEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

/** Extrai usuário/senha/porta/banco da DATABASE_URL do backend. */
export function dbConfig() {
  const env = readEnv(path.join(BACKEND, '.env'));
  if (!env.DATABASE_URL) fail('DATABASE_URL não encontrada em odramech-backend/.env (rode "npm run setup").');
  const url = new URL(env.DATABASE_URL);
  return {
    user: decodeURIComponent(url.username || 'postgres'),
    password: decodeURIComponent(url.password || ''),
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.replace(/^\//, '') || 'odramech',
  };
}

export function portInUse(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const sock = net.connect({ port, host });
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error', () => resolve(false));
    sock.setTimeout(800, () => { sock.destroy(); resolve(false); });
  });
}

export async function waitForPort(port, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await portInUse(port)) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}
