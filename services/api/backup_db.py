"""Create a consistent SQLite backup while the API runs."""
import os
import sqlite3
from datetime import datetime,timezone
from accounts import database_path
path=database_path()
if not path.exists():
    raise SystemExit('O banco ainda não existe; não há contas ou planos para copiar.')
folder=path.parent/'backups';folder.mkdir(exist_ok=True,mode=0o700)
target=folder/('financemed-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.sqlite3')
os.close(os.open(target,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600))
with sqlite3.connect(path) as source,sqlite3.connect(target) as destination:
    source.backup(destination)
print(target)
