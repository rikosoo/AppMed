# FinanceMed AI

MVP web responsivo para planejamento financeiro de médicos. Interface em português, navegação inferior no celular e lateral no desktop. Contas individuais e planejamentos persistem em SQLite no servidor. Consulte [domínio e persistência](docs/DOMINIO.md) e [base administrativa](docs/ADMIN.md).

## Executar

Requisitos: Node.js 22+ e Python 3.12+. Na raiz do repositório:

### Início rápido (Windows, macOS e Linux)

Com Node.js e Python instalados, execute na pasta principal (a que contém `package.json`):

```powershell
npm ci
npm run dev
```

O iniciador procura o Python (incluindo `py -3` no Windows), cria `.venv` se ela não existir e instala as dependências da API quando faltarem. Essa primeira preparação precisa de conexão de rede. O erro `No module named uvicorn` é tratado por essa verificação.

### Preparação manual no Windows (PowerShell)

```powershell
npm ci
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --require-hashes -r services/api/requirements.lock
npm run dev
```

### Preparação manual no macOS / Linux

```bash
npm ci
python -m venv .venv
.venv/bin/pip install --require-hashes -r services/api/requirements.lock
npm run dev
```

O iniciador foi escrito para Windows, macOS e Linux; não exige Bash ou WSL. A execução real e a recuperação de dependências foram validadas no cloud Linux; o caminho e a seleção do Python no Windows têm testes automatizados, sem uma máquina Windows neste ambiente. O comando inicia Next.js na porta 3000 e FastAPI na porta 8000. A interface encaminha `/api/*` para a API. Para hospedagem separada, configure `API_URL` no ambiente do Next.js antes de compilar. A API escuta somente em loopback por padrão; não tem autenticação e não deve ser exposta diretamente à internet.

Se a porta 3000 estiver ocupada, encerre a interface antiga com Ctrl+C antes de iniciar. Uma API já ativa na porta 8000 só é reutilizada se responder como FinanceMed com a versão esperada; outros serviços ou versões antigas geram orientação para parar o servidor. O iniciador encerra apenas os processos que ele criou.

Para executar separadamente em dois terminais: `npm run dev:api` e `npm run dev:web`. O comando `npm run dev --workspace=apps/web` também inicia somente a interface; o cálculo depende da API estar ativa.

Para produção local, execute `npm run build`, inicie `.venv/bin/uvicorn main:app --app-dir services/api --host 127.0.0.1 --port 8000` e, em outro terminal, `npm start`.

## Acesso e primeiro preenchimento

Use **Criar conta** para cadastrar usuário e senha (mínimo 8 caracteres). A sessão usa cookie HttpOnly; senhas são armazenadas com hash scrypt. Não existe mais login fixo. Em produção, use HTTPS. Ainda não há recuperação de senha por e-mail.

No primeiro acesso sem histórico, o assistente pede trabalhos, despesas (ou a escolha explícita de continuar sem despesas), meta líquida e disponibilidade, sem valores financeiros preenchidos. Ao abrir um mês novo com histórico anterior, o aplicativo pergunta se você quer revisar e atualizar, manter os mesmos dados ou começar do zero. A cópia só acontece após a escolha; cenários salvos não são copiados e o mês de origem não é alterado. A virada de mês também é detectada quando o aplicativo está aberto ou volta a ficar visível. Depois de concluir, os próximos acessos recuperam os dados daquele mês. Os dados de exemplo de versões anteriores são retirados da tela e preservados em `localStorage["financemed.legacy-demo.v1"]`; planejamentos sem a marca de demonstração são mantidos.

## O que funciona

- Início: receitas previstas, despesas, renda líquida, progresso e tempo comprometido.
- Trabalhos: criar, editar e excluir até seis fontes de renda; valor bruto por unidade, regime PF/PJ, líquido estimado, minutos comprometidos, quantidade prevista e limite adicional.
- Despesas: criar, editar e excluir custos de cada mês, sem dupla contagem de custos por unidade.
- Meta: renda líquida desejada e horas totais disponíveis, incluindo atividades previstas.
- Otimizar: até três combinações distintas, classificadas por tempo, proximidade da meta e alternativa mista; resultados podem ser menos de três quando não existirem combinações distintas. Cada opção detalha quantidades e nomes dos trabalhos, ganho incremental e horas adicionais/totais. Quando a meta é impossível, mostra até três alternativas parciais, com o valor que ainda falta; não as apresenta como metas alcançadas.
- Cenários salvos preservam entradas, resultado e versão do motor. Salvar não altera previsão nem registra recebimentos.
- Planejamentos independentes por mês, persistência por conta no servidor, exportação JSON para consulta.
- Entrada local, saída de sessão e preenchimento inicial guiado em três etapas, sem dados fictícios.

## Cálculos e limites

Dinheiro em centavos inteiros e tempo em minutos inteiros. Novos trabalhos recebem valor bruto e regime escolhido manualmente: Pessoa Física aplica desconto estimado fixo de 27%; Pessoa Jurídica, 15%. O imposto é arredondado ao centavo mais próximo por unidade (meio centavo para cima) e subtraído do bruto. O otimizador usa esse valor líquido. A API verifica se bruto, regime e líquido são consistentes. Essas taxas são parâmetros de simulação solicitados para o MVP, não alíquotas oficiais ou cálculo fiscal completo. Custos adicionais entram separadamente em Despesas. Cadastros antigos, já informados como líquidos, são preservados sem nova tributação; ao escolher PF/PJ em um desses cadastros, o campo é limpo para pedir explicitamente o bruto. As despesas da aba Despesas são subtraídas uma vez da receita projetada. Sobreaviso usa todo o tempo comprometido. O motor desconta as horas previstas antes de buscar atividades adicionais e enumera até 500 mil combinações; limites maiores retornam erro orientando reduzir a busca, sem aproximar silenciosamente.

A meta impossível informa a receita incremental máxima dentro dos limites. A projeção acima da disponibilidade é sinalizada mesmo quando já alcança a meta. Os cenários pressupõem que haja demanda pelas atividades. Esta versão não modela calendário, conflitos, descanso, prontuário ou tributação oficial. Os valores são projeções, não comprovantes de receitas realizadas.

## Persistência e privacidade

Os dados são separados por conta no banco SQLite; o navegador mantém cópia temporária de alterações ainda não salvas. Não cadastrar dados de pacientes. Faça backup do volume do banco. A migração do armazenamento antigo deste navegador exige confirmação explícita; mudar de domínio não transfere automaticamente o armazenamento antigo. Consulte docs/DOMINIO.md.

## Verificação

```bash
npm run test:api
npm run test:proxy
npm run test:launcher
npm run typecheck
npm run build
# Com os dois servidores ativos e Chromium instalado:
npm run test:e2e
```

Os testes Playwright usam `/usr/bin/chromium`; é possível substituir via `CHROMIUM_PATH`. Cobrem login válido/inválido, cadastro guiado, saída, persistência, migração de demonstrações e otimização em 390px e 1440px. Os testes Python verificam cálculo exato, cenários mistos, horas existentes, meta impossível/alcançada, excesso de capacidade, validação e limites de busca.

## Próxima etapa

Após validar a experiência: autenticação gerenciada, PostgreSQL com isolamento por usuário, sincronização e recuperação de dados. Manifesto web e ícone estão incluídos; cache offline e aplicativo nativo ainda não foram implementados. O PRD completo em `docs/PRD.md` é referência para fases futuras, não uma declaração de funcionalidades entregues.

## Exemplo de combinação e diagnóstico da API

Faltando R$ 43.800, com consultas líquidas de R$ 500/1h e plantões líquidos de R$ 1.200/12h, há três opções dentro de 116h adicionais se os limites permitirem: 88 consultas (R$ 44.000, 88h); 86 consultas + 1 plantão (R$ 44.200, 98h); 83 consultas + 2 plantões (R$ 43.900, 107h). Se o limite for 9 consultas e 2 plantões, o máximo é R$ 6.900 em 33h; os cartões são marcados como parciais. O sistema nunca aumenta os limites automaticamente nem preenche dados financeiros com esses exemplos.

A rota Next.js `/api/optimizer` faz a ponte com a API. Falha de conexão ou resposta de erro em texto retorna uma mensagem em português; não tenta exibir `Internal Server Error` como JSON. Execute `npm run dev` para iniciar os dois serviços, ou confira o terminal FastAPI na porta 8000. Alterações no motor Python exigem reiniciar a API.

## Layout mobile first

Os estilos responsivos em `apps/web/app/responsive.css` partem de uma coluna e navegação inferior. Campos usam fonte de 16px para evitar zoom automático no iPhone, botões têm área de toque de pelo menos 44px e formulários abrem como painel inferior em telas pequenas, com rolagem do fundo bloqueada. A partir de 640px entram colunas adicionais; a partir de 1024px, navegação lateral. Testes verificam as cinco telas, login, cadastro inicial e diálogos nas larguras de 320, 390, 768, 1024 e 1440px.

## Teto de horas e alternativas para completar a meta

A disponibilidade mensal é limitada a 360 horas na interface e na API. As três opções principais continuam dentro da disponibilidade e dos limites de unidades informados.

Quando a meta não é viável nesses limites, a seção ampliada apresenta **até três combinações para cobrir apenas o valor que falta**, sem preencher desnecessariamente 360h. A primeira opção encontra o menor tempo adicional necessário por programação dinâmica exata em minutos. As alternativas exploram cotas de 25%, 50% e 75% da renda adicional entre atividades, inclusive duas cotas simultâneas para criar mixes de três trabalhos. A seleção prioriza atividades novas, mudanças relevantes nas quantidades e distância entre as composições. Quando possível, pelo menos dois trabalhos contribuem com 20% ou mais da renda adicional de uma alternativa. As alternativas não representam as três melhores soluções globais nem garantem variedade quando só existe uma atividade viável. Unidades que poderiam ser removidas sem perder a meta são retiradas para evitar trabalho desnecessário.

O critério principal é atingir a meta com menos horas. Unidades são inteiras, então pode sobrar algum valor financeiro. Cada cartão mostra renda incremental, composição por trabalho, horas adicionais necessárias, horas além da disponibilidade (0h quando couber) e tempo total do mês. A soma dos trabalhos previstos e adicionais nunca excede 360h. Se a meta for impossível até esse teto, são exibidas alternativas parciais com a diferença restante.

Somente nas alternativas ampliadas, limites positivos de unidades podem ser ultrapassados; limite zero continua excluindo a atividade. Os detalhes de limites ficam recolhidos em cada cartão para priorizar a combinação e o tempo necessário. Nada é aplicado ou salvo automaticamente, e os cadastros permanecem inalterados. Confirme demanda e viabilidade da rotina antes de assumir novas atividades.

O motor usa centavos e minutos inteiros. Testes verificam o menor tempo contra busca exaustiva independente, metas inviáveis, exclusões, histórico e layouts de 320 a 1440px. Cadastros históricos acima de 360h não são apagados: a disponibilidade precisa ser corrigida antes de otimizar ou reutilizar o mês.

## Publicar na AWS

Veja o passo a passo em [docs/AWS.md](docs/AWS.md). Os arquivos em `deploy/` iniciam Next.js, FastAPI e Caddy com HTTPS e acesso restrito. O servidor publicado usa Docker Compose em modo de produção, não `npm run dev`. Para atualizar uma instalação já configurada: `bash scripts/update-server.sh`, executado no SSH do servidor.

## Aplicativos Android e iOS

A base Capacitor compartilha a interface com a web e a empacota localmente. Consulte [MOBILE.md](docs/MOBILE.md) para sincronizar, abrir no Android Studio/Xcode e testar. `npm run mobile:sync` gera os assets dos dois projetos. A publicação e os testes em aparelhos ainda são etapas separadas.

O deploy agora usa somente o login próprio do FinanceMed; a janela externa de senha do Caddy foi retirada para permitir o transporte nativo de sessão. Atualize o servidor antes de testar os aplicativos.

## Preparação para as lojas

Consulte [STORE-READINESS.md](docs/STORE-READINESS.md) para ícones, abertura, privacidade, exclusão de conta e builds manuais no GitHub. As páginas `/privacidade`, `/suporte` e `/excluir-conta` são públicas. A exclusão com senha fica em Minha conta e revoga as sessões de todos os dispositivos. A etapa de assinatura e publicação ainda não foi executada.

Nos cartões regulares, a primeira opção continua sendo a melhor por horas (meta atingida) ou renda (meta inviável). As demais priorizam mixes distintos dentro das horas e dos limites cadastrados. Para alternativas parciais mistas, a seleção prefere pelo menos 65% da renda adicional da primeira opção em Mix equilibrado, 50% em Mais variedade e 80% em Menos horas quando esse patamar estiver disponível. Se não existir mix nesse patamar, pode apresentar um mix com renda menor, explicitamente mostrado no cartão. As combinações ampliadas continuam separadas, com teto total de 360h e alertas de limites excedidos.

A otimização calcula automaticamente ao abrir a tela com dados completos e ao editar limites/prioridades. Há três prioridades para as alternativas: Menos horas, Mix equilibrado e Mais variedade. A primeira opção de referência continua ótima. O avatar e o perfil lateral abrem Minha conta, onde é possível alterar usuário/senha com confirmação da senha atual, preservando os planejamentos e encerrando as outras sessões.

Recuperação de senha por e-mail confirmado, configuração SMTP e teste de entrega: [docs/PASSWORD-RECOVERY.md](docs/PASSWORD-RECOVERY.md). Campos monetários aceitam `15.000` (R$ 15.000,00), `15.000,50` e decimais simples com ponto ou vírgula; valores são guardados em centavos inteiros.

Revisão de segurança, limites de produção, validações realizadas e pendências da infraestrutura: [docs/SECURITY-REVIEW.md](docs/SECURITY-REVIEW.md).
