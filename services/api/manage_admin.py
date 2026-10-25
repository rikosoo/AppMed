"""Run on the server: python manage_admin.py USERNAME. No public elevation endpoint."""
import argparse
import time
from accounts import connect, normalize_username

def main():
    parser=argparse.ArgumentParser(description='Promove uma conta existente a administrador.')
    parser.add_argument('username')
    args=parser.parse_args()
    with connect() as db:
        row=db.execute('SELECT id,status FROM users WHERE username=?',(normalize_username(args.username),)).fetchone()
        if not row or row['status']!='active': parser.error('Conta ativa não encontrada. Cadastre-a pelo aplicativo primeiro.')
        db.execute("UPDATE users SET role='admin' WHERE id=?",(row['id'],))
        db.execute('INSERT INTO admin_audit(actor_id,action,subject_id,created_at) VALUES (?,?,?,?)',('server-cli','grant_admin',row['id'],int(time.time())))
    print('Permissão administrativa atribuída à conta existente.')

if __name__=='__main__': main()
