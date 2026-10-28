# Revisão complementar dos oito pontos

As mudanças são locais ao repositório e precisam ser aplicadas na EC2. Nenhum banco de produção foi acessado ou apagado nesta revisão.

| Ponto | Verificação e correção |
| --- | --- |
| 1. Bloqueio de login e cadastro | O bloqueio de oito falhas por usuário ainda permitia impedir o login de outra pessoa. Agora vale por par usuário + cliente durante 15 minutos; outro cliente pode autenticar normalmente. O limite persistente por cliente já existia: 60 logins/5 minutos e 20 cadastros/15 minutos. Recuperar a senha limpa as falhas anteriores. Clientes no mesmo NAT compartilham o endereço e os limites; ataques distribuídos exigem controles adicionais. |
| 2. Repasse genérico da API | Removido o rewrite genérico do Next. Só os handlers explícitos encaminham chamadas; caminhos desconhecidos retornam 404/405. A documentação automática da API continua desativada em produção. `/api/health` é deliberadamente público e agora só informa `{status: "ok"}` quando saudável, sem dados de contas ou detalhes do motor. |
| 3. CSRF | Em produção, toda escrita em `/api/*` exige `Origin` permitido, inclusive o otimizador, através do middleware central. A ausência do cabeçalho é rejeitada. O modo de desenvolvimento permite clientes de teste sem metadados de navegação; origens externas continuam bloqueadas. |
| 4. Confiança no proxy | Caddy, Next e API compartilham uma credencial interna. O Next exige a credencial do Caddy antes de aceitar IP/protocolo encaminhados; a API exige credencial e HTTPS para rotas privadas em produção. Falsificar apenas `x-forwarded-proto` não permite acesso direto. Healthcheck público permanece disponível. As portas 8000/3000 continuam privadas. |
| 5. Dependências Python | Os dois arquivos `.lock` já eram rastreados no Git. Agora incluem hashes SHA-256, gerados a partir dos arquivos `.in`. Docker, bootstrap local e instalação de desenvolvimento usam `--require-hashes`. `requirements.txt` referencia o lock completo e não mantém uma lista divergente. |
| 6. Histórico de segredos | No commit `b05d6b8`, `deploy/.env.example` contém `SMTP_PASSWORD=` vazio. Foram examinados os 29 commits acessíveis nesta cópia com padrões de atribuições SMTP, chaves privadas e chaves AWS; não foi identificada credencial real nesses padrões. Isso não cobre objetos inacessíveis, outros clones nem todos os formatos possíveis de segredo. Não houve reescrita de histórico. |
| 7. scrypt e CPU | A atualização anterior já utiliza scrypt N=32768, r=8, p=3, sal aleatório e migração do hash antigo no login válido. Permanecem quatro operações de senha simultâneas por processo, tamanho máximo de senha e limites persistentes de requisições por cliente. |
| 8. Contas bloqueadas | Mantida a mesma mensagem de login para conta inexistente, bloqueada ou senha incorreta. O painel administrativo continua acessível apenas com autorização do servidor. |

## Credencial interna sem senha adicional no navegador

`scripts/configure-proxy-token.py` gera `INTERNAL_PROXY_TOKEN` com aleatoriedade criptográfica, preserva as outras variáveis e uma credencial válida existente, grava atomicamente com permissão 0600 e não imprime o valor. Recusa arquivo simbólico, variáveis duplicadas ou token existente fraco. O atualizador executa esse passo automaticamente. O segredo fica apenas no servidor; não integra o JavaScript entregue ao navegador ou o aplicativo móvel.

Na primeira atualização para esta versão, busque o novo atualizador **antes** de executá-lo:

```bash
cd ~/AppMed
git pull --ff-only origin main
bash scripts/update-server.sh
```

Se houver alterações locais, preserve e resolva antes de prosseguir. O script faz backup consistente do SQLite, compila antes de substituir os serviços e preserva os volumes. Não apague o banco nem o `.env`. Para uma instalação nova, o guia [AWS.md](AWS.md) inclui a geração da credencial antes de validar o compose.

## Validação

- 84 testes da API; teste adicional de recuperação confirma que redefinir a senha libera as falhas anteriores.
- 30 testes selecionados da interface em celular/computador, cobrindo segurança, contas, perfil, recuperação e otimização automática.
- 11 testes dos proxies, quatro do inicializador, typecheck, build web e sincronização móvel.
- Instalação Python com verificação de hashes e `pip-audit`: nenhum aviso conhecido no lock verificado.
- Build real dos três containers e serviços saudáveis com dados fictícios em projeto Docker isolado.
- HTTPS local: cadastro, sessão, gravação do planejamento, exigência de Origin no otimizador, healthcheck mínimo e bloqueio de caminhos não permitidos.
- Chamadas diretas à API e ao Next, com protocolo HTTPS forjado e sem a credencial interna, retornaram 403.

Não houve acesso à AWS, auditoria de Security Groups, EBS, IAM, backups externos nem teste de invasão independente. O certificado interno de localhost foi aceito apenas pelo cliente de teste. As proteções reduzem os problemas apontados, sem garantir ausência de vulnerabilidades.
