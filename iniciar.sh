#!/usr/bin/env bash
# Sobe o Odramech no Linux (equivalente ao iniciarWin.bat). Na primeira vez roda o setup.sh.
#   bash iniciar.sh
set -euo pipefail
cd "$(dirname "$0")"

command -v node >/dev/null 2>&1 || { echo "Node.js não encontrado. Rode: bash setup.sh"; exit 1; }

for dir in odramech-backend odramech-frontend odramech-assinaturas; do
  if [ ! -d "$dir/node_modules" ]; then
    echo "Primeira execução: preparando o ambiente…"
    bash setup.sh
    break
  fi
done

export ODRAMECH_NO_BROWSER=1
exec node scripts/dev.mjs
