// Sobe um PostgreSQL local SEM Docker e SEM instalação (binários via npm: embedded-postgres).
// Os dados ficam em .data/postgres (ignorado pelo git).
//
//   node scripts/db.mjs            → sobe e fica rodando (Ctrl+C para parar)
//   node scripts/db.mjs --reset    → apaga os dados locais e recria do zero
//
// Se já existir um Postgres escutando na porta da DATABASE_URL (instalado ou via Docker),
// ele é usado e este script não sobe outro.
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { dbConfig, fail, ok, portInUse, readEnv, ROOT, step, SUBSCRIPTIONS, warn } from './lib.mjs';

export const DATA_DIR = path.join(ROOT, '.data', 'postgres');

/** Bancos que o ambiente precisa: o da oficina e o do serviço de assinaturas. */
function requiredDatabases(main) {
  const names = new Set([main.database]);
  const subsEnv = readEnv(path.join(SUBSCRIPTIONS, '.env'));
  if (subsEnv.DATABASE_URL) names.add(new URL(subsEnv.DATABASE_URL).pathname.replace(/^\//, ''));
  return [...names].filter(Boolean);
}

/** Cria os bancos que faltarem (idempotente), em qualquer Postgres acessível. */
async function ensureDatabases(cfg) {
  let pg;
  try {
    ({ default: pg } = await import('pg'));
  } catch {
    warn('Driver "pg" indisponível — crie os bancos manualmente se ainda não existirem.');
    return;
  }
  const client = new pg.Client({ host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: 'postgres' });
  try {
    await client.connect();
    for (const name of requiredDatabases(cfg)) {
      const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
      if (!rowCount) {
        await client.query(`CREATE DATABASE "${name.replace(/"/g, '')}"`);
        ok(`Banco "${name}" criado.`);
      }
    }
  } catch (err) {
    warn(`Não foi possível conferir/criar os bancos: ${err.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

export async function startDatabase({ reset = false } = {}) {
  const cfg = dbConfig();

  if (!['localhost', '127.0.0.1', '::1'].includes(cfg.host)) {
    ok(`DATABASE_URL aponta para ${cfg.host} — usando banco externo.`);
    await ensureDatabases(cfg);
    return { stop: async () => {}, external: true };
  }

  if (await portInUse(cfg.port)) {
    ok(`Já existe um PostgreSQL na porta ${cfg.port} — usando ele.`);
    await ensureDatabases(cfg);
    return { stop: async () => {}, external: true };
  }

  let EmbeddedPostgres;
  try {
    ({ default: EmbeddedPostgres } = await import('embedded-postgres'));
  } catch {
    fail('Pacote embedded-postgres não instalado. Rode "npm run setup" na raiz do projeto.');
  }

  if (reset && existsSync(DATA_DIR)) {
    warn('Apagando dados locais do banco (.data/postgres)…');
    rmSync(DATA_DIR, { recursive: true, force: true });
  }

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: cfg.user,
    password: cfg.password,
    port: cfg.port,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--no-locale'],
    onLog: () => {},
  });

  if (!existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
    step('Criando banco local pela primeira vez (leva alguns segundos)…');
    await pg.initialise();
  }

  await pg.start();
  await ensureDatabases(cfg);
  ok(`PostgreSQL rodando em localhost:${cfg.port}`);

  return { stop: () => pg.stop(), external: false };
}

// Execução direta
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const db = await startDatabase({ reset: process.argv.includes('--reset') });
  if (db.external) process.exit(0);
  console.log('  (Ctrl+C para parar o banco)');
  const shutdown = async () => { await db.stop(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  setInterval(() => {}, 1 << 30);
}
