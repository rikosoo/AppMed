"""Create the server-only proxy credential without exposing it or editing other settings."""
import argparse
import os
from pathlib import Path
import re
import secrets
import tempfile


def configure(path:Path):
    if path.is_symlink():raise ValueError('O arquivo de configuração não pode ser um link simbólico.')
    original=path.read_text()
    lines=original.splitlines(keepends=True)
    matches=[i for i,line in enumerate(lines) if re.match(r'^\s*(?:export\s+)?INTERNAL_PROXY_TOKEN\s*=',line)]
    if len(matches)>1:raise ValueError('Remova a configuração duplicada de INTERNAL_PROXY_TOKEN.')
    if matches:
        raw=lines[matches[0]].split('=',1)[1].strip()
        if raw[:1] in ('\"',"'") and raw[-1:]==raw[:1]:raw=raw[1:-1]
        if raw:
            if not re.fullmatch(r'[A-Za-z0-9_-]{43,128}',raw):
                raise ValueError('INTERNAL_PROXY_TOKEN precisa ter de 43 a 128 caracteres URL-safe. Não compartilhe o valor.')
            os.chmod(path,0o600)
            return False
    value=secrets.token_urlsafe(48)
    if matches:lines[matches[0]]=f'INTERNAL_PROXY_TOKEN={value}\n'
    else:
        if lines and not lines[-1].endswith('\n'):lines[-1]+='\n'
        lines.append(f'INTERNAL_PROXY_TOKEN={value}\n')
    mode=path.stat()
    descriptor,temp=tempfile.mkstemp(prefix='.env.proxy-',dir=path.parent)
    try:
        with os.fdopen(descriptor,'w') as output:
            output.write(''.join(lines));output.flush();os.fsync(output.fileno())
            os.fchmod(output.fileno(),0o600)
            if hasattr(os,'geteuid') and os.geteuid()==0:os.fchown(output.fileno(),mode.st_uid,mode.st_gid)
        os.replace(temp,path)
    finally:
        if os.path.exists(temp):os.unlink(temp)
    return True


def main():
    parser=argparse.ArgumentParser(description='Configura a credencial privada entre Caddy, web e API sem mostrar o valor.')
    parser.add_argument('env_file',nargs='?',default='deploy/.env')
    args=parser.parse_args()
    try:
        changed=configure(Path(args.env_file))
    except (OSError,ValueError):
        parser.exit(1,'Não foi possível configurar a credencial interna. Confira permissões, duplicatas e o formato indicado em deploy/.env.example. Nenhum valor foi exibido.\n')
    print('Credencial interna configurada.' if changed else 'Credencial interna já configurada; valor preservado.')

if __name__=='__main__':main()
