# Publicar o FinanceMed AI na AWS e atualizar o servidor

Este guia usa **AWS Lightsail + Ubuntu 24.04 LTS + Docker Compose + Caddy**. O Lightsail é uma máquina virtual gerenciada pela AWS. A interface Next.js e a API FastAPI ficam em contêineres; o Caddy fornece HTTPS automático. Não use `npm run dev` no servidor publicado.

## Antes de começar

- Conta AWS e um domínio ou subdomínio que você controla, por exemplo `finance.seudominio.com.br`.
- Instância Ubuntu 24.04 LTS com **4 GB de RAM recomendados**, porque a compilação acontece na própria máquina. Confira o preço mensal na AWS antes de criar.
- O aplicativo usa contas individuais em SQLite; o login próprio protege os dados e a API; a proteção externa do Caddy foi retirada para a integração mobile. Consulte [a configuração atual de domínio e banco](DOMINIO.md), inclusive `APP_ORIGIN`, antes de atualizar um deploy anterior.
- Contas e planejamentos ficam no volume persistente `api_data`. Ao mudar de endereço, entre com a mesma conta para carregar os dados já salvos no servidor. Nunca use `down -v` em um ambiente com dados que deseja preservar.

## 1. Criar a máquina no Lightsail

1. Entre no console da AWS e abra **Lightsail**.
2. Clique em **Create instance / Criar instância**.
3. Escolha a região mais próxima dos seus usuários.
4. Selecione **Linux/Unix**, depois **OS Only / Somente sistema operacional**, e **Ubuntu 24.04 LTS**.
5. Escolha a capacidade (4 GB de RAM recomendados), nomeie a máquina, por exemplo `financemed`, e crie.
6. Espere ficar em execução e use **Connect using SSH / Conectar por SSH** no navegador.

**Os comandos deste guia são executados no terminal Ubuntu da AWS, não no PowerShell do seu computador.**

## 2. Fixar o IP e configurar o domínio

1. Em Networking / Redes do Lightsail, crie um **Static IP / IP estático** e associe-o à instância. Use esse IP no DNS.
2. No provedor do seu domínio (Registro.br, Route 53, Cloudflare etc.), adicione um registro **A**:

   - Nome: `finance` (para usar `finance.seudominio.com.br`).
   - Valor: o IPv4 estático da instância.
   - TTL: 300, ou o padrão do provedor.

3. Aguarde a propagação. Se usar Cloudflare, comece com esse registro em **DNS only / Somente DNS**.
4. No firewall da instância, em Networking, libere **TCP 80 (HTTP)** e **TCP 443 (HTTPS)**. Mantenha o acesso SSH necessário para sua conexão. **Não abra 3000 nem 8000**: apenas o Caddy publica portas.

O domínio correto e as portas 80/443 precisam estar acessíveis para o certificado HTTPS ser emitido automaticamente. Não crie registro AAAA sem configurar também o acesso IPv6 correspondente.

## 3. Instalar Docker e baixar o projeto

No SSH da máquina Ubuntu:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 docker-buildx git
sudo systemctl enable --now docker
sudo docker compose version
sudo docker buildx version
cd ~
git clone --branch main https://github.com/rikosoo/AppMed.git
cd AppMed
```

Se `docker-compose-v2` não estiver disponível na imagem escolhida, siga a instalação oficial do Docker Engine e do plugin Compose para Ubuntu, no link ao fim deste guia. Não instale simultaneamente implementações diferentes do Compose.

Não precisa instalar Node, npm ou Python na máquina: eles estão nas imagens Docker.

## 4. Configurar o domínio

```bash
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
nano deploy/.env
```

Preencha:

```dotenv
APP_DOMAIN=finance.seudominio.com.br
APP_ORIGIN=https://finance.seudominio.com.br
```

Use somente o nome do domínio em APP_DOMAIN e a origem HTTPS em APP_ORIGIN, sem /admin. O login próprio do FinanceMed substitui a janela externa de senha do Caddy; as variáveis BASIC_AUTH antigas não são mais utilizadas. No Nano, Ctrl+O e Enter salvam, Ctrl+X sai.

A credencial `INTERNAL_PROXY_TOKEN` é criada pelo comando abaixo, fica somente no servidor e é compartilhada pelos três serviços. O valor não é exibido, não deve ser commitado e não é uma senha adicional para os usuários.

## 5. Compilar e iniciar

Na pasta `~/AppMed`:

```bash
python3 scripts/configure-proxy-token.py deploy/.env
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml config --quiet
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml build
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml up -d --wait --wait-timeout 180
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml ps
```

A primeira compilação pode demorar. API, interface e Caddy devem ficar `healthy`.

Abra **https://finance.seudominio.com.br** no navegador. Crie sua conta individual pelo login do FinanceMed.

Para conferir pelo SSH, substitua o domínio:

```bash
curl --fail https://finance.seudominio.com.br/api/health
```

O resultado esperado contém `"status":"ok"`. Faça também um teste funcional: entre no app, cadastre informações fictícias e execute o otimizador. Apenas uma porta aberta não valida o cálculo.

Os contêineres usam `restart: unless-stopped`, e o Docker inicia com o sistema. Os certificados ficam nos volumes `caddy_data` e `caddy_config`; não exclua esses volumes em uma atualização normal.

## 6. Atualizar depois que uma alteração estiver no GitHub

As alterações feitas pelo Codex precisam estar enviadas à branch `main`. Entre novamente pelo SSH e execute:

```bash
cd ~/AppMed
git pull --ff-only origin main
bash scripts/update-server.sh
```

O `git pull` inicial garante que esta primeira atualização já execute o script que configura a credencial interna. Se houver conflito ou alteração local, preserve-a e resolva antes de continuar.

Esse script:

1. Recusa atualizar se houver alterações locais não preservadas.
2. Mostra o SHA da versão anterior: guarde-o para uma eventual volta.
3. Faz `git pull --ff-only origin main`.
4. Compila as imagens enquanto a versão atual continua executando.
5. Recria os serviços e aguarda os checks de saúde da API e da interface.

Quando a compilação falha, os contêineres antigos continuam funcionando. A recriação dos serviços pode causar uma breve indisponibilidade; este guia não configura atualização sem interrupção nem rollback automático.

Depois, abra o site, atualize a página e teste o fluxo alterado. Manter o mesmo domínio mantém o armazenamento daquele navegador. Não execute `git reset --hard`, não remova `.env` nem apague volumes para atualizar.

### Atualização manual equivalente

```bash
cd ~/AppMed
git pull --ff-only origin main
python3 scripts/configure-proxy-token.py deploy/.env
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml build
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml up -d --wait --wait-timeout 180
```

## 7. Voltar à versão anterior, se necessário

Use o SHA completo que o script mostrou antes de atualizar. A árvore Git precisa estar sem alterações locais. Substitua `SHA_DA_VERSAO_ANTERIOR` pelo valor real:

```bash
cd ~/AppMed
git switch --detach SHA_DA_VERSAO_ANTERIOR
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml build
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml up -d --wait --wait-timeout 180
```

Esse rollback vale para versões que já incluem os arquivos de deploy. Teste o site novamente. Ele não restaura dados do navegador ou configurações de acesso modificadas manualmente.

Para voltar a acompanhar atualizações da branch principal:

```bash
git switch main
bash scripts/update-server.sh
```

## 8. Diagnóstico e manutenção

### Logs

```bash
cd ~/AppMed
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml logs --tail 100 web api
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml logs --tail 100 caddy
```

### Erros comuns

- **Não abre o domínio:** confira o registro A, IP estático e portas 80/443.
- **Não emite certificado:** confira a propagação do DNS e os logs do Caddy. Não desative a verificação HTTPS para contornar o problema.
- **Caddy falha ao iniciar:** confira APP_DOMAIN, DNS e os logs do Caddy.
- **401 na API:** é necessário entrar na conta do FinanceMed. Se ainda aparecer uma janela de senha do navegador, o Caddy em execução ainda está na configuração antiga.
- **Erro no otimizador:** confira `web` e `api`; `API_URL` deve continuar `http://api:8000` dentro dos contêineres.
- **Atualização rejeitada por alterações locais:** preserve/revise o que mudou antes de continuar. `.env` é ignorado e não exige commit.
- **Compilação encerrada por falta de memória:** aumente a RAM da instância antes de repetir a compilação.

Faça snapshots do Lightsail antes de mudanças importantes e guarde, de forma segura, a configuração do servidor. Faça também backup online do SQLite, conforme DOMINIO.md. Atualizações do Ubuntu também exigem manutenção periódica e, às vezes, reinício da máquina.

## Referências

- [Começar com AWS Lightsail](https://docs.aws.amazon.com/lightsail/latest/userguide/getting-started-with-amazon-lightsail.html)
- [IP estático no Lightsail](https://docs.aws.amazon.com/lightsail/latest/userguide/lightsail-create-static-ip.html)
- [Instalar Docker no Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [HTTPS automático do Caddy](https://caddyserver.com/docs/automatic-https)

## Validação e limites

A interface web e a interface mobile empacotada são compiladas separadamente. A API tem testes de permissões e isolamento por conta; os fluxos web têm testes de navegador. A ponte nativa tem testes simulados que não substituem execução em aparelhos. Consulte MOBILE.md. Este guia não executa ações na conta AWS nem confirma DNS/certificados da instalação do leitor.
