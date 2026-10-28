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
python3 scripts/configure-proxy-token.py deploy/.env
# Copy the live SQLite database consistently before replacing the API image.
# The first upgrade from the demo version has no database yet.
api_container="$(sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml ps --status running -q api)"
if [[ -n "$api_container" ]]; then
  sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml exec -T api python - <<'PYBACKUP'
import os,sqlite3
from pathlib import Path
from datetime import datetime,timezone
path=Path(os.environ.get('DATABASE_PATH','/data/financemed.sqlite3'))
if path.exists():
    folder=path.parent/'backups';folder.mkdir(exist_ok=True,mode=0o700)
    target=folder/('before-update-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.sqlite3')
    os.close(os.open(target,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600))
    with sqlite3.connect(path) as source,sqlite3.connect(target) as destination:
        source.backup(destination)
    print('Backup consistente do banco criado:',target)
else:
    print('Sem banco anterior nesta versão; primeira atualização para contas persistentes.')
PYBACKUP
fi
previous_commit="$(git rev-parse HEAD)"
echo "Versão anterior (guarde para rollback): $previous_commit"
git pull --ff-only origin main
python3 scripts/configure-proxy-token.py deploy/.env
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml config --quiet
# Build first: a compilation failure keeps the currently running containers intact.
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml build --pull
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml up -d --wait --wait-timeout 180
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml ps
echo "Atualizado para $(git rev-parse --short HEAD). Confira o site no navegador."
