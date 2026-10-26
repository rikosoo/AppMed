# Preparação das lojas — etapa 4

A versão inclui identidade visual nativa, abertura, páginas públicas e exclusão real de conta. A etapa 5 (assinatura e envio) ainda não foi executada.

## Endereços para os formulários

Após atualizar a EC2 e conferir as páginas sem login:

| Campo | Endereço |
|---|---|
| Site | https://app.75hard.club |
| Política de privacidade | https://app.75hard.club/privacidade |
| Exclusão de conta (Google Play) | https://app.75hard.club/excluir-conta |
| Suporte | https://app.75hard.club/suporte |
| E-mail de contato | contact@dresslikeme.store |
| Nome do canal de suporte | Contato Suporte |

O endereço de contato foi informado pelo responsável; a disponibilidade da caixa não foi verificada. Antes de enviar às lojas, revisar o texto da política, confirmar o nome legal da pessoa/empresa titular do serviço e preencher a identidade verificada nas contas de desenvolvedor. O nome do canal de suporte não substitui a identidade legal.

## Ícones e abertura

Os recursos Android e iOS agora usam o símbolo verde do FinanceMed existente no site. A fonte está em `apps/mobile/assets/logo.svg`. Para regenerar:

```bash
npm run mobile:assets
npm run mobile:sync
```

Inclui ícones adaptativos Android, ícone iOS 1024×1024 opaco e telas de abertura claras/escuras. O ícone 512×512 para o Google Play está em `apps/mobile/store-assets/icon-google-play-512.png`. O Android 12+ usa o ícone do tema na abertura; o plugin SplashScreen limita a tela de abertura a aproximadamente um segundo, sem aguardar a API. Validar aparência nos aparelhos. Gráfico de destaque e capturas finais das lojas ainda precisam ser preparados com o aplicativo real; não representam testes executados no iPhone.

## Exclusão e backups

O usuário abre Minha conta → Excluir minha conta, informa senha e digita EXCLUIR. A API verifica sessão, origem, senha, limite de tentativas e conta esperada. Remove usuário, planejamento, cenários, sessões, métricas individuais e referências de auditoria. A cópia pendente desta conta no dispositivo atual é removida; exportações externas e dados locais em outros aparelhos não são apagados remotamente. Sessões desses aparelhos deixam de autorizar acesso ao servidor.

O arquivo `account-deletions.sqlite3`, ao lado do banco principal no volume `api_data`, guarda somente UUID aleatório e data de exclusão. Não contém nomes, senhas ou valores financeiros. Ele impede que restaurar uma cópia antiga do banco principal reative uma conta excluída: a API reaplica as exclusões antes de acessar os dados.

**Ao restaurar, preserve sempre a versão mais recente desse registro separado.** Não substitua esse arquivo por uma versão anterior nem restaure um snapshot completo sobre a instalação atual sem preservar o registro mais recente. Mantenha também uma cópia atualizada dele fora da instância junto ao procedimento de recuperação.

Backups locais gerados por `backup_db.py` e pelo script de atualização, com nomes `financemed-DATA.sqlite3`/`before-update-DATA.sqlite3`, são removidos após 30 dias pelo serviço em funcionamento, inclusive suas verificações de saúde. Arquivos manuais e snapshots externos não são gerenciados por essa rotina: o operador deve aplicar o mesmo prazo a eles. A exclusão não é promessa de destruição física instantânea de todos os blocos do disco/WAL. A política descreve remoção do serviço ativo e conservação temporária de backups.

## Builds de teste pelo GitHub

O workflow **Mobile test builds** é manual: não roda em cada push e não publica nas lojas.

1. No repositório GitHub, abra Actions → Mobile test builds → Run workflow.
2. Escolha `android`, `ios` ou `both`, na branch main.
3. Aguarde terminar e abra o resultado da execução.
4. Baixe o artefato `FinanceMed-Android-debug` ou `FinanceMed-iOS-simulator`.

Android gera APK debug para testes (não AAB de publicação). iOS compila em runner macOS e gera um `.app` para simulador, **não IPA para iPhone**. Não precisa de certificados Apple para compilar esse simulador. O artefato exige Mac/simulador para executar; em Windows é possível acompanhar o log de compilação. O workflow foi preparado, mas uma execução remota bem-sucedida ainda deve ser confirmada no GitHub.

O domínio padrão é app.75hard.club. A variável de repositório `FINANCEMED_API_ORIGIN` permite configurar outra origem HTTPS para o build, sujeita à validação do projeto. Os artefatos são retidos por 7 dias. Nenhuma chave de assinatura, conta real ou senha de revisor fica no workflow.

## Teste de aceitação

Use uma conta de teste para a exclusão:

- Cadastrar no site, entrar com a mesma conta no Android e conferir os mesmos dados.
- Alterar no Android, aguardar Salvo no servidor, atualizar o site e conferir. Se as duas telas editarem ao mesmo tempo, o conflito deve impedir sobrescrita silenciosa.
- Fechar/reabrir o app, verificar sessão, teclado, áreas seguras e botão Voltar.
- Exportar/importar JSON; alternar rede e verificar erro/repetição sem apagar dados.
- Abrir Minha conta, cancelar exclusão e confirmar que a conta continua ativa.
- Confirmar exclusão com senha da conta de teste; verificar que outro dispositivo não consegue carregar/salvar dados com a sessão antiga.
- Repetir em iOS antes da publicação. A compilação do simulador não substitui teste de execução e revisão visual.

## Informações de dados a revisar nas lojas

Não marque o app como sem coleta de dados. Ele transmite e armazena conta, planejamento financeiro e uso associado ao usuário. A classificação exata depende dos formulários vigentes:

| Dado | Finalidade atual |
|---|---|
| Nome de usuário/identificador; pode conter e-mail escolhido pelo usuário | Conta e autenticação |
| Trabalhos, rendimentos, despesas, metas e cenários | Planejamento financeiro e sincronização |
| Datas de acesso e eventos de uso | Funcionamento e métricas do serviço |
| Informações técnicas de conexão e erros do servidor | Segurança e operação |

Sem anúncios, compras, rastreamento publicitário ou coleta de localização/câmera/microfone nas funções atuais. O manifesto iOS de APIs usadas não substitui as declarações de dados do App Store Connect. A política e os formulários devem acompanhar mudanças futuras de SDKs e funcionalidades.

## Antes da etapa 5

Confirmar identificador definitivo `club.hard75.financemed`, nome do app, titular legal, política revisada, suporte funcional, screenshots e gráfico de destaque. Criar contas Google Play Console e Apple Developer. Preparar AAB/Archive de release assinados, versões/build numbers, classificação etária e credenciais de uma conta exclusiva de revisão sem dados reais. Guardar chaves fora do Git. A aprovação depende de cada loja; nada foi enviado automaticamente.
