# Revisão local de segurança

Foram revisados autenticação, sessões, recuperação de senha, acesso a planejamentos, permissões administrativas, proxies, dependências e configuração Docker. As correções estão no repositório e só passam a valer na EC2 após a atualização. Não há garantia de ausência de vulnerabilidades; esta revisão não substitui um teste de invasão independente nem uma auditoria da conta AWS.

## Correções

| Ponto revisado | Resultado |
| --- | --- |
| Requisições de cálculo sem limite antes de carregar JSON no proxy | Limite de 64 KB no proxy e na API; autenticação limitada a 10 KB e planejamentos a 2 MB. O Caddy também limita corpos a 2 MB. A leitura do corpo na API tem prazo de 30 segundos. |
| Criação automatizada de contas, tentativas em vários usuários e cálculos repetidos | Limites persistidos no SQLite, por cliente e por usuário. Não dependem de um contador que desaparece ao reiniciar o processo. |
| Identificação de cliente falsificada por cabeçalhos | O Caddy substitui o cabeçalho de IP pelo endereço da conexão. Os proxies privados validam esse valor; cabeçalhos enviados pelo cliente não prevalecem. Tráfego interno não passa por proxies HTTP externos. |
| Consumo de memória/CPU por concorrência | Até dois cálculos simultâneos por processo e quatro operações de derivação de senha. Excesso de cálculos retorna 429 com orientação para tentar novamente. |
| Gravação que já havia passado pela autenticação, mas cuja sessão foi revogada durante a requisição | A sessão é conferida novamente dentro da transação que grava o planejamento. |
| Exibição do site dentro de páginas de terceiros | `frame-ancestors 'none'` e `X-Frame-Options: DENY`. Também foram definidos `nosniff`, política de referência, restrições de objetos/formulários e permissões do navegador. O Caddy envia HSTS sem incluir outros subdomínios. A CSP é parcial; não pretende bloquear todo XSS por si só. |
| Validações reproduzindo dados enviados | Respostas de validação da API não devolvem senhas, tokens ou documentos financeiros. Respostas da API usam `Cache-Control: no-store`. |
| Proteção de senha abaixo do custo recomendado atualmente | Novos hashes usam scrypt N=32768, r=8, p=3 e sal aleatório. O formato antigo continua aceito e é atualizado no login válido. Contas e planejamentos não são substituídos. |
| Confirmações de e-mail solicitadas por múltiplas contas | Limite compartilhado por destinatário entre cadastro e configuração de conta, além dos limites já existentes por conta e endereço de recuperação. |
| Dependências conhecidamente vulneráveis | `pytest` foi atualizado de 9.0.2 para 9.0.3. A API de produção instala apenas `requirements.runtime.lock`, sem pytest/httpx. A cadeia de ferramentas móveis agora usa Capacitor CLI 8.5.3, tar 7.5.22, sharp 0.35.5 e xcode 4.0.0. |
| Arquivos e privilégios dos containers | API e web continuam sem root e agora usam sistema de arquivos da aplicação somente para leitura, sem capabilities e sem elevação de privilégios. Banco, cache e temporários ficam nos locais próprios. Arquivos de chaves privadas foram adicionados às exclusões de Git e Docker. |
| Atualizações futuras | O atualizador busca imagens-base atualizadas com `build --pull`. O workflow `security.yml` verifica dependências e testes em pushes/PRs, manualmente e semanalmente, sem credenciais AWS. |

As atualizações de ferramentas móveis usam `overrides` explícitos no package.json, pois o gerador de assets ainda declara versões antigas. Foram verificados `npm ci`, compilação web, `mobile:sync` e geração real de 74 arquivos Android e sete iOS em cópias temporárias. Não houve alteração dos ícones originais nem redução da versão do Capacitor. Ao atualizar ferramentas, revise essas substituições e repita os testes.

## Limites de produção

| Operação | Limite |
| --- | --- |
| Cadastro | 20 solicitações por cliente / 15 minutos |
| Login | 60 por cliente / 5 minutos, além do bloqueio existente de oito falhas por usuário / 15 minutos |
| Solicitar recuperação | 10 por cliente / 15 minutos, além de cinco por endereço / 15 minutos |
| Enviar confirmação de e-mail | Cinco por endereço / 15 minutos, compartilhadas entre contas |
| Otimizar | 30 por cliente / minuto e 20 por usuário / minuto; máximo de dois cálculos simultâneos por processo |
| Demais escritas | 120 por cliente / minuto, compartilhadas entre as rotas restantes |

São janelas fixas com contadores temporários e chaves derivadas do IP por SHA-256; IPv6 é agrupado por /64. Usuários atrás do mesmo NAT compartilham o limite de cliente. A API de desenvolvimento desativa esses limites por padrão; os testes os ativam explicitamente quando necessário. O compose de produção ativa os limites. Eles reduzem abuso básico, mas não são proteção completa contra ataques distribuídos.

**API e web não podem ter as portas 8000/3000 publicadas.** A confiança no cabeçalho de cliente depende da rede privada e do Caddy sobrescrevendo o valor. A única entrada pública prevista no compose é o Caddy nas portas 80/443. Não remova a substituição dos cabeçalhos nem exponha os serviços internos diretamente.

## Verificações realizadas

- 80 testes da API, incluindo isolamento entre contas, autorização administrativa, revogação de sessões, redefinição de senha, limites de abuso e compatibilidade com hashes antigos.
- 80 testes da interface em celular e computador; nomes de trabalhos contendo HTML permaneceram texto, sem execução de código.
- Dez testes dos proxies e dois da ponte nativa simulada Android/iOS. Não é validação em um iPhone/Android real.
- `npm audit` completo: zero avisos conhecidos após as correções, incluindo ferramentas de desenvolvimento. A verificação anterior tinha sete pacotes sinalizados; a parte de produção JavaScript já não tinha avisos conhecidos.
- `pip-audit`: zero avisos conhecidos nas versões Python fixadas após a atualização. O aviso anterior era da ferramenta de testes, não evidência de invasão remota do app.
- Bandit: sem alertas pendentes. As buscas administrativas passaram a usar SQL fixo parametrizado. O lote de limpeza de contas mantém apenas placeholders SQL gerados internamente, com os identificadores sempre vinculados por parâmetro; a exceção B608 está justificada localmente e coberta por teste com um identificador malicioso. Não há desativação global da regra.
- Nenhum padrão de chave privada ou chave de acesso AWS foi encontrado nos arquivos rastreados examinados. Isso não representa auditoria do histórico Git, do seu computador ou dos segredos na AWS.
- Instalação completa em três containers locais isolados, com dados fictícios, TLS do Caddy, cookies Secure/HttpOnly/SameSite, planejamento privado, negação a acesso administrativo e limites preservados mesmo tentando falsificar IPs nos cabeçalhos.
- Login e gravação de meta no navegador através do HTTPS local, com a aplicação somente para leitura. Banco com permissão 0600, processos API/web sem root e sem elevação de privilégio foram conferidos. Nenhuma biblioteca de teste ficou instalada na imagem da API.

O certificado interno de localhost foi aceito apenas pelo cliente de teste. A validação TLS dos serviços publicados e do SMTP permanece habilitada no aplicativo.

## O que depende da AWS e continua sem verificação

Não houve acesso SSH/console AWS nesta revisão. A tentativa de consultar o domínio público foi bloqueada pelo proxy de rede do ambiente de execução, portanto não confirmou o estado atual do site publicado.

Antes de considerar a infraestrutura revisada, confira Security Group (80/443 públicos; SSH limitado ao IP necessário), portas reais dos containers, criptografia de EBS e snapshots, permissões IAM e backups externos com restauração testada. Permissões 0600 e volumes privados não criptografam, por si só, o conteúdo SQLite. Quem possui acesso administrativo ao servidor pode ler o banco.

Não foram executados scanner de vulnerabilidades do sistema operacional das imagens, auditoria específica das bibliotecas Gradle/Android e Swift/iOS, teste de invasão independente, teste em aparelhos reais nem entrega SMTP real. MFA para administradores e uma proteção de borda contra ataques distribuídos continuam como melhorias recomendadas para uma publicação com maior exposição.

## Aplicação das mudanças

Na EC2, após revisar as mudanças:

```bash
cd ~/AppMed
bash scripts/update-server.sh
```

O script cria backup antes da atualização e compila antes de substituir containers. Preserve `deploy/.env` e os volumes de dados. Nenhuma migração exige apagar contas ou recriar o banco. Se existir alteração local no código, o script para para evitar sobrescrevê-la.

No computador que compila o aplicativo:

```powershell
git pull
npm ci
npm run mobile:sync
```

Execute novamente pelo Android Studio. O lockfile foi atualizado: use `npm ci` para instalar exatamente a árvore de dependências revisada. As mudanças no servidor não são aplicadas apenas reconstruindo o APK.
