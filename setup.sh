#!/usr/bin/env bash
# Prepara o Odramech do zero num Ubuntu (Server ou Desktop). Equivalente ao setup.bat do Windows.
#
#   bash setup.sh
#
# O que faz:
#   1. confere o Node (18–22)
#   2. cria os .env a partir dos .env.example, se não existirem
#   3. instala o PostgreSQL pelo apt, se não houver um rodando na porta da DATABASE_URL
#   4. cria o usuário e os bancos (odramech e odramech_assinaturas) com a senha do .env
#   5. roda scripts/setup.mjs: dependências, migrations (cria schemas e tabelas), Prisma Client e seeds
#
# Pode rodar de novo quando quiser: tudo é idempotente.
set -euo pipefail

cd "$(dirname "$0")"

ORANGE=$'\e[38;5;208m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RED=$'\e[31m'; BOLD=$'\e[1m'; RESET=$'\e[0m'
step() { echo; echo "${ORANGE}▸${RESET} ${BOLD}$*${RESET}"; }
ok()   { echo "  ${GREEN}✓${RESET} $*"; }
warn() { echo "  ${YELLOW}!${RESET} $*"; }
fail() { echo; echo "${RED}✗ $*${RESET}"; echo; exit 1; }

# sudo só quando não somos root
if [ "$(id -u)" -eq 0 ]; then SUDO=""; AS_PG="runuser -u postgres --"; else SUDO="sudo"; AS_PG="sudo -u postgres"; fi

# ---------------------------------------------------------------- 1. Node
step "Verificando Node.js"
if ! command -v node >/dev/null 2>&1; then
  fail "Node.js não encontrado. Instale o Node 22 LTS, por exemplo:
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  e rode este script de novo."
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 18 ] || fail "Node $(node -v) é antigo demais. Instale o Node 22 LTS (veja https://nodejs.org)."
ok "Node $(node -v)"

# ---------------------------------------------------------------- 2. .env
step "Arquivos .env"
for dir in odramech-backend odramech-frontend odramech-assinaturas; do
  if [ -f "$dir/.env" ]; then
    ok "$dir/.env encontrado"
  elif [ -f "$dir/.env.example" ]; then
    cp "$dir/.env.example" "$dir/.env"
    warn "$dir/.env criado a partir do .env.example — revise os valores (senhas, chaves, NODE_ENV)."
  else
    fail "$dir/.env não encontrado."
  fi
done

# Lê usuário/senha/host/porta e os nomes dos bancos das DATABASE_URL (backend + assinaturas)
mapfile -t DB < <(node --input-type=module -e '
  import { readEnv } from "./scripts/lib.mjs";
  const main = new URL(readEnv("odramech-backend/.env").DATABASE_URL);
  const subsUrl = readEnv("odramech-assinaturas/.env").DATABASE_URL;
  const subs = subsUrl ? new URL(subsUrl) : null;
  const name = u => u.pathname.replace(/^\//, "");
  console.log(decodeURIComponent(main.username || "postgres"));
  console.log(decodeURIComponent(main.password || ""));
  console.log(main.hostname);
  console.log(main.port || "5432");
  console.log(name(main) || "odramech");
  console.log(subs ? name(subs) : "");
')
DB_USER="${DB[0]}"; DB_PASS="${DB[1]}"; DB_HOST="${DB[2]}"; DB_PORT="${DB[3]}"; DB_MAIN="${DB[4]}"; DB_SUBS="${DB[5]:-}"

# ---------------------------------------------------------------- 3. PostgreSQL
step "PostgreSQL"
case "$DB_HOST" in
  localhost|127.0.0.1|::1) LOCAL_DB=1 ;;
  *) LOCAL_DB=0 ;;
esac

port_open() { (exec 3<>"/dev/tcp/127.0.0.1/$DB_PORT") 2>/dev/null; }

if [ "$LOCAL_DB" -eq 0 ]; then
  ok "DATABASE_URL aponta para $DB_HOST — usando banco externo (os bancos serão criados pelo setup se o usuário tiver permissão)."
else
  if ! command -v psql >/dev/null 2>&1 && ! port_open; then
    command -v apt-get >/dev/null 2>&1 || fail "PostgreSQL não encontrado e este sistema não tem apt-get. Instale o PostgreSQL e rode de novo."
    warn "PostgreSQL não encontrado — instalando pelo apt…"
    $SUDO apt-get update -y
    $SUDO apt-get install -y postgresql postgresql-contrib
  fi
  if ! port_open; then
    $SUDO systemctl enable --now postgresql >/dev/null 2>&1 || $SUDO service postgresql start
    for _ in $(seq 1 30); do port_open && break; sleep 1; done
  fi
  port_open || fail "Nenhum PostgreSQL escutando em localhost:$DB_PORT. Confira 'port' no postgresql.conf ou a porta da DATABASE_URL."
  ok "PostgreSQL rodando em localhost:$DB_PORT"

  # ------------------------------------------------------------ 4. usuário e bancos
  step "Usuário e bancos"
  if id postgres >/dev/null 2>&1; then
    # psql como superusuário local (autenticação peer). Valores passam como variáveis do psql
    # (:'u', :'pw'), então aspas ou caracteres especiais na senha não quebram nem injetam SQL.
    run_psql() { $AS_PG psql -X -q -v ON_ERROR_STOP=1 -p "$DB_PORT" "$@"; }
    (cd /tmp && run_psql -v u="$DB_USER" -v pw="$DB_PASS" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN CREATEDB', :'u') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'u') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'u', :'pw') \gexec
SQL
    )
    ok "usuário \"$DB_USER\" pronto (senha igual à da DATABASE_URL)"
    for db in "$DB_MAIN" $DB_SUBS; do
      (cd /tmp && run_psql -v u="$DB_USER" -v db="$db" <<'SQL'
SELECT format('CREATE DATABASE %I OWNER %I ENCODING ''UTF8'' TEMPLATE template0', :'db', :'u') WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db') \gexec
SELECT format('GRANT ALL ON DATABASE %I TO %I', :'db', :'u') \gexec
SQL
      )
      # banco criado à mão antes (dono = postgres): o usuário do app precisa poder criar o schema
      (cd /tmp && run_psql -d "$db" -v u="$DB_USER" <<'SQL'
SELECT format('GRANT CREATE ON SCHEMA public TO %I', :'u') \gexec
SQL
      )
      ok "banco \"$db\""
    done
  else
    warn "Usuário de sistema 'postgres' não existe (Postgres em Docker?). O setup tenta criar os bancos com a DATABASE_URL."
  fi
fi

# ---------------------------------------------------------------- 5. dependências, migrations, seeds
node scripts/setup.mjs
