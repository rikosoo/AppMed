# FinanceMed AI

MVP web responsivo para planejamento financeiro de médicos. Interface em português, navegação inferior no celular e lateral no desktop. Esta entrega é a versão local de validação escolhida pelo usuário, com acesso de demonstração e sem banco de dados.

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
.\.venv\Scripts\python.exe -m pip install -r services/api/requirements.lock
npm run dev
```

### Preparação manual no macOS / Linux

```bash
npm ci
python -m venv .venv
.venv/bin/pip install -r services/api/requirements.lock
npm run dev
```

O iniciador foi escrito para Windows, macOS e Linux; não exige Bash ou WSL. A execução real e a recuperação de dependências foram validadas no cloud Linux; o caminho e a seleção do Python no Windows têm testes automatizados, sem uma máquina Windows neste ambiente. O comando inicia Next.js na porta 3000 e FastAPI na porta 8000. A interface encaminha `/api/*` para a API. Para hospedagem separada, configure `API_URL` no ambiente do Next.js antes de compilar. A API escuta somente em loopback por padrão; não tem autenticação e não deve ser exposta diretamente à internet.

Se a porta 3000 estiver ocupada, encerre a interface antiga com Ctrl+C antes de iniciar. Uma API já ativa na porta 8000 só é reutilizada se responder como FinanceMed com a versão esperada; outros serviços ou versões antigas geram orientação para parar o servidor. O iniciador encerra apenas os processos que ele criou.

Para executar separadamente em dois terminais: `npm run dev:api` e `npm run dev:web`. O comando `npm run dev --workspace=apps/web` também inicia somente a interface; o cálculo depende da API estar ativa.

Para produção local, execute `npm run build`, inicie `.venv/bin/uvicorn main:app --app-dir services/api --host 127.0.0.1 --port 8000` e, em outro terminal, `npm start`.

## Acesso e primeiro preenchimento

Usuário: `123456`. Senha: `123456`. Os campos de login começam vazios. Este acesso fixo é apenas uma barreira visual de demonstração no navegador, não autenticação segura: não protege a API nem cria usuários separados. Não publique como serviço autenticado. A sessão fica no `sessionStorage`; Sair encerra o acesso e mantém os dados financeiros no navegador.

No primeiro acesso sem histórico, o assistente pede trabalhos, despesas (ou a escolha explícita de continuar sem despesas), meta líquida e disponibilidade, sem valores financeiros preenchidos. Ao abrir um mês novo com histórico anterior, o aplicativo pergunta se você quer revisar e atualizar, manter os mesmos dados ou começar do zero. A cópia só acontece após a escolha; cenários salvos não são copiados e o mês de origem não é alterado. A virada de mês também é detectada quando o aplicativo está aberto ou volta a ficar visível. Depois de concluir, os próximos acessos recuperam os dados daquele mês. Os dados de exemplo de versões anteriores são retirados da tela e preservados em `localStorage["financemed.legacy-demo.v1"]`; planejamentos sem a marca de demonstração são mantidos.

## O que funciona

- Início: receitas previstas, despesas, renda líquida, progresso e tempo comprometido.
- Trabalhos: criar, editar e excluir até seis fontes de renda; valor bruto por unidade, regime PF/PJ, líquido estimado, minutos comprometidos, quantidade prevista e limite adicional.
- Despesas: criar, editar e excluir custos de cada mês, sem dupla contagem de custos por unidade.
- Meta: renda líquida desejada e horas totais disponíveis, incluindo atividades previstas.
- Otimizar: até três combinações distintas, classificadas por tempo, proximidade da meta e alternativa mista; resultados podem ser menos de três quando não existirem combinações distintas. Cada opção detalha quantidades e nomes dos trabalhos, ganho incremental e horas adicionais/totais. Quando a meta é impossível, mostra até três alternativas parciais, com o valor que ainda falta; não as apresenta como metas alcançadas.
- Cenários salvos preservam entradas, resultado e versão do motor. Salvar não altera previsão nem registra recebimentos.
- Planejamentos independentes por mês, persistência em `localStorage` e exportação JSON de todos os meses.
- Entrada local, saída de sessão e preenchimento inicial guiado em três etapas, sem dados fictícios.

## Cálculos e limites

Dinheiro em centavos inteiros e tempo em minutos inteiros. Novos trabalhos recebem valor bruto e regime escolhido manualmente: Pessoa Física aplica desconto estimado fixo de 27%; Pessoa Jurídica, 15%. O imposto é arredondado ao centavo mais próximo por unidade (meio centavo para cima) e subtraído do bruto. O otimizador usa esse valor líquido. A API verifica se bruto, regime e líquido são consistentes. Essas taxas são parâmetros de simulação solicitados para o MVP, não alíquotas oficiais ou cálculo fiscal completo. Custos adicionais entram separadamente em Despesas. Cadastros antigos, já informados como líquidos, são preservados sem nova tributação; ao escolher PF/PJ em um desses cadastros, o campo é limpo para pedir explicitamente o bruto. As despesas da aba Despesas são subtraídas uma vez da receita projetada. Sobreaviso usa todo o tempo comprometido. O motor desconta as horas previstas antes de buscar atividades adicionais e enumera até 500 mil combinações; limites maiores retornam erro orientando reduzir a busca, sem aproximar silenciosamente.

A meta impossível informa a receita incremental máxima dentro dos limites. A projeção acima da disponibilidade é sinalizada mesmo quando já alcança a meta. Os cenários pressupõem que haja demanda pelas atividades. Esta versão não modela calendário, conflitos, descanso, prontuário ou tributação oficial. Os valores são projeções, não comprovantes de receitas realizadas.

## Persistência e privacidade

Dados são guardados apenas neste navegador, sem sincronização entre dispositivos. O cálculo envia entradas à API FastAPI, que não grava em banco e não registra corpos das requisições. Não cadastrar dados de pacientes. Limpar o armazenamento do navegador apaga os dados; exporte cópias. A exportação JSON é uma cópia para consulta: importação/restauração pela interface ainda não foi implementada. Dados locais inválidos não são sobrescritos automaticamente.

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

## Teto de horas e comparação com alerta

A disponibilidade mensal é limitada a 280 horas na interface e na API. As opções principais continuam dentro da disponibilidade escolhida. Se a meta não for viável nessas horas, o motor busca separadamente uma única simulação acima da disponibilidade, mantendo os limites de unidades e o teto absoluto de 280 horas totais (trabalhos já previstos + adicionais). Prioriza atingir a meta com a menor sobra financeira; se não der, mostra o maior alcance possível. O cartão vermelho informa o excesso em horas, o total do mês e a diferença para a meta. É apenas uma comparação: não altera a disponibilidade, não pode ser salva como cenário regular e não aumenta quantidades máximas automaticamente.

Se não houver combinação extra possível até 280h, ou a busca adicional superar 500 mil combinações, o app explica a limitação e preserva os resultados normais. Cadastros históricos acima do teto não são apagados: é necessário corrigir a disponibilidade antes de otimizar ou reutilizá-la em outro mês.
