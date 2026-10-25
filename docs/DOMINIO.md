# EC2 e domínio de teste

O desenvolvimento não depende de IP fixo. Para manter `app.75hard.club` estável:

1. No console EC2, aloque um **Elastic IP** e associe à instância que executa o Docker. A AWS cobra pelo IPv4 público; confira o preço da sua região.
2. No provedor DNS de `75hard.club`, crie um registro **A**: nome `app`, valor igual ao Elastic IP. Não altere os demais registros do domínio. Se usar proxy DNS, deixe inicialmente apenas DNS para validar o certificado diretamente.
3. No Security Group associado à instância, permita TCP 80 e 443 de `0.0.0.0/0`; mantenha SSH limitado ao seu IP. Não publique as portas internas 3000 e 8000.
4. Depois de atualizar o código e antes de recriar os serviços, ajuste `deploy/.env`, preservando as variáveis de proteção já existentes:

```env
APP_DOMAIN=app.75hard.club
APP_ORIGIN=https://app.75hard.club
```

5. Execute em `~/AppMed`:

```bash
git pull --ff-only
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml build
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml up -d --wait --wait-timeout 180
```

6. Acesse `https://app.75hard.club`. O Caddy solicita o certificado automaticamente quando o DNS e as portas estão corretos. Para diagnosticar:

```bash
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml logs --tail=80 caddy
```

Contas reais usam cookies seguros e precisam de HTTPS nesta configuração de produção. O acesso pelo IP sem HTTPS serve apenas para o teste anterior; não use `APP_DOMAIN=:80` nesta configuração. O cadastro substitui o antigo login fixo `123456`; crie sua própria senha de pelo menos 8 caracteres. A proteção externa por senha do Caddy continua independente do login do aplicativo.

## Persistência e backup

Contas, senhas com hash e planejamentos ficam no volume `api_data`, separados por usuário. Não execute `docker compose down -v`: isso apaga os volumes. Atualizar/recriar os containers preserva os dados. Antes de atualizar, faça backup:

```bash
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml exec api python backup_db.py
```

O comando imprime o caminho do backup dentro do container. Copie uma cópia para fora da EC2 e proteja-a, pois contém dados das contas. O script `scripts/update-server.sh` também cria backup antes de atualizar um banco existente. Ainda não há recuperação de senha por e-mail.

Os dados antigos do navegador não migram automaticamente entre localhost, IP e domínio. Exporte o JSON no endereço antigo e importe na configuração inicial da sua conta no endereço novo, conferindo antes de confirmar. O arquivo original permanece intacto.

Ao trocar de domínio futuramente, ajuste DNS, `APP_DOMAIN` e `APP_ORIGIN`, e recrie os serviços. Usuários precisarão entrar novamente no novo endereço; o banco permanece no volume.
