"""Deletion enforcement across live data and restored database backups."""
import os
import sqlite3
import time
from datetime import datetime, timezone

BACKUP_DAYS=30

def ledger_path(path):
    return path.with_name('account-deletions.sqlite3')

def record_deletion(path,user_id):
    target=ledger_path(path)
    connection=sqlite3.connect(target,timeout=10)
    try:
        os.chmod(target,0o600)
        with connection:
            connection.execute('CREATE TABLE IF NOT EXISTS deleted_accounts (user_id TEXT PRIMARY KEY,deleted_at INTEGER NOT NULL)')
            connection.execute('INSERT OR IGNORE INTO deleted_accounts VALUES (?,?)',(user_id,int(time.time())))
    finally:
        connection.close()

def purge_account(db,user_id):
    row=db.execute('SELECT username FROM users WHERE id=?',(user_id,)).fetchone()
    if not row:return
    db.execute('DELETE FROM sessions WHERE user_id=?',(user_id,))
    db.execute('DELETE FROM plans WHERE user_id=?',(user_id,))
    db.execute('DELETE FROM usage_daily WHERE user_id=?',(user_id,))
    db.execute('DELETE FROM admin_audit WHERE actor_id=? OR subject_id=?',(user_id,user_id))
    db.execute('DELETE FROM login_failures WHERE username=?',(row['username'],))
    db.execute('DELETE FROM login_client_failures WHERE username=?',(row['username'],))
    db.execute('DELETE FROM users WHERE id=?',(user_id,))

def enforce_deletions(db,path):
    target=ledger_path(path)
    if not target.exists():return
    ledger=sqlite3.connect(target,timeout=10)
    try: ids=[row[0] for row in ledger.execute('SELECT user_id FROM deleted_accounts')]
    finally: ledger.close()
    for start in range(0,len(ids),500):
        batch=ids[start:start+500]
        placeholders=','.join('?' for _ in batch)
        # Only '?' placeholders are interpolated; every identifier stays a bound value.
        for row in db.execute(f'SELECT id FROM users WHERE id IN ({placeholders})',batch).fetchall():  # nosec B608
            purge_account(db,row['id'])
    db.commit()

def prune_backups(path,now=None):
    folder=path.parent/'backups'
    if not folder.exists():return
    cutoff=(time.time() if now is None else now)-BACKUP_DAYS*86400
    for pattern in ('financemed-*.sqlite3','before-update-*.sqlite3'):
        for file in folder.glob(pattern):
            if file.is_symlink() or not file.is_file():continue
            try:
                stamp=file.stem.rsplit('-',1)[1]
                created=datetime.strptime(stamp,'%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc).timestamp()
            except ValueError:continue
            if created<cutoff:file.unlink(missing_ok=True)
