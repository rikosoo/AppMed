#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f deploy/.env ]]; then
  echo "Configure deploy/.env conforme docs/AWS.md antes de atualizar."
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Existem alterações locais no projeto. Preserve seu trabalho antes de atualizar."
  exit 1
fi
if [[ "$(git symbolic-ref --short -q HEAD || true)" != "main" ]]; then
  echo "A atualização espera a branch main. Após um rollback, execute git switch main primeiro."
  exit 1
fi
previous_commit="$(git rev-parse HEAD)"
echo "Versão anterior (guarde para rollback): $previous_commit"
git pull --ff-only origin main
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml config --quiet
# Build first: a compilation failure keeps the currently running containers intact.
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml build
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml up -d --wait --wait-timeout 180
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml ps
echo "Atualizado para $(git rev-parse --short HEAD). Confira o site no navegador."
