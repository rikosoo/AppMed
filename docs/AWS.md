# Publicar o FinanceMed AI na AWS e atualizar o servidor

Este guia usa **AWS Lightsail + Ubuntu 24.04 LTS + Docker Compose + Caddy**. O Lightsail é uma máquina virtual gerenciada pela AWS. A interface Next.js e a API FastAPI ficam em contêineres; o Caddy fornece HTTPS automático e uma senha extra de acesso. Não use `npm run dev` no servidor publicado.

## Antes de começar

- Conta AWS e um domínio ou subdomínio que você controla, por exemplo `finance.seudominio.com.br`.
- Instância Ubuntu 24.04 LTS com **4 GB de RAM recomendados**, porque a compilação acontece na própria máquina. Confira o preço mensal na AWS antes de criar.
- Este é um ambiente de demonstração restrito. O login interno `123456` continua sendo demonstrativo; a senha extra do Caddy protege o acesso ao site e à API, sem criar contas individuais.
- Os dados financeiros continuam no `localStorage` do navegador. Dados do `localhost` **não aparecem automaticamente no novo domínio**, nem em outro dispositivo. Exporte uma cópia antes de mudar de endereço. A versão atual exporta JSON para consulta, mas ainda não importa/restaura esse arquivo pela interface. Não existe banco de dados de usuários neste deploy.

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

## 4. Criar a senha externa e configurar o domínio

Gere o hash de uma senha forte, diferente do login demonstrativo do app:

```bash
sudo docker run --rm -it caddy:2-alpine caddy hash-password
```

Digite a senha quando o comando pedir. Guarde a senha para abrir o site e copie **apenas o hash gerado** para a configuração abaixo. Não coloque a senha original no GitHub ou no chat.

```bash
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
nano deploy/.env
```

Preencha as três linhas com seus valores:

```dotenv
APP_DOMAIN=finance.seudominio.com.br
BASIC_AUTH_USER=admin
BASIC_AUTH_HASH='COLE_AQUI_O_HASH_GERADO_PELO_CADDY'
```

Use apenas o nome do domínio em `APP_DOMAIN`, sem `https://` e sem barra no final. **Mantenha as aspas simples ao redor do hash**, pois ele contém caracteres `$`. No nano, `Ctrl+O`, Enter salva; `Ctrl+X` sai.

O arquivo real `deploy/.env` é ignorado pelo Git e pelo contexto do Docker. Não use `docker compose config` sem `--quiet` ao compartilhar logs, pois esse comando pode exibir configurações de acesso.

## 5. Compilar e iniciar

Na pasta `~/AppMed`:

```bash
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml config --quiet
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml build
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml up -d --wait --wait-timeout 180
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml ps
```

A primeira compilação pode demorar. API, interface e Caddy devem ficar `healthy`.

Abra **https://finance.seudominio.com.br** no navegador. Primeiro ele pedirá o usuário `admin` e a senha forte do passo 4. Depois aparece o login de demonstração do FinanceMed (`123456` / `123456`).

Para conferir pelo SSH, substitua o domínio e digite a senha externa quando o curl pedir:

```bash
curl --fail --user admin https://finance.seudominio.com.br/api/health
```

O resultado esperado contém `"status":"ok"`. Faça também um teste funcional: entre no app, cadastre informações fictícias e execute o otimizador. Apenas uma porta aberta não valida o cálculo.

Os contêineres usam `restart: unless-stopped`, e o Docker inicia com o sistema. Os certificados ficam nos volumes `caddy_data` e `caddy_config`; não exclua esses volumes em uma atualização normal.

## 6. Atualizar depois que uma alteração estiver no GitHub

As alterações feitas pelo Codex precisam estar enviadas à branch `main`. Entre novamente pelo SSH e execute:

```bash
cd ~/AppMed
bash scripts/update-server.sh
```

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
- **Caddy falha ao iniciar:** confira domínio, usuário e hash no `.env`; o hash precisa manter os `$` e as aspas simples no arquivo.
- **401:** o usuário ou a senha externa não foram enviados ou estão incorretos. Essa senha é diferente do login interno `123456`.
- **Erro no otimizador:** confira `web` e `api`; `API_URL` deve continuar `http://api:8000` dentro dos contêineres.
- **Atualização rejeitada por alterações locais:** preserve/revise o que mudou antes de continuar. `.env` é ignorado e não exige commit.
- **Compilação encerrada por falta de memória:** aumente a RAM da instância antes de repetir a compilação.

Faça snapshots do Lightsail antes de mudanças importantes e guarde, de forma segura, a configuração do servidor. Snapshot da máquina não salva o `localStorage` que está no computador ou celular do usuário. Atualizações do Ubuntu também exigem manutenção periódica e, às vezes, reinício da máquina.

## Referências

- [Começar com AWS Lightsail](https://docs.aws.amazon.com/lightsail/latest/userguide/getting-started-with-amazon-lightsail.html)
- [IP estático no Lightsail](https://docs.aws.amazon.com/lightsail/latest/userguide/lightsail-create-static-ip.html)
- [Instalar Docker no Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [HTTPS automático do Caddy](https://caddyserver.com/docs/automatic-https)
- [Autenticação básica no Caddy](https://caddyserver.com/docs/caddyfile/directives/basic_auth)

## O que foi validado nesta entrega

As três imagens Docker foram compiladas. Em um teste local isolado, API, interface e Caddy ficaram saudáveis; requisições sem senha retornaram 401, requisições autenticadas à interface e à saúde retornaram 200, e o otimizador calculou três alternativas pela rota de produção. A sintaxe do script de atualização e a configuração Compose foram verificadas. A criação de recursos na sua conta AWS, a instalação do Ubuntu, a configuração do DNS e a emissão pública do certificado HTTPS ainda dependem da execução deste guia.
