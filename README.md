# FinanceMed AI

MVP web responsivo para planejamento financeiro de médicos. Interface em português, navegação inferior no celular e lateral no desktop. Esta entrega é a versão local de validação escolhida pelo usuário, sem login ou banco de dados.

## Executar

Requisitos: Node.js 22+ e Python 3.12+. Na raiz do repositório:

```bash
npm ci --cache /workspace/.npm-cache
python -m venv .venv
.venv/bin/pip install -r services/api/requirements.lock
npm run dev
```

O comando inicia Next.js na porta 3000 e FastAPI na porta 8000. A interface encaminha `/api/*` para a API. Para hospedagem separada, configure `API_URL` no ambiente do Next.js antes de compilar. A API escuta somente em loopback por padrão; não tem autenticação e não deve ser exposta diretamente à internet.

Para produção local, execute `npm run build`, inicie `.venv/bin/uvicorn main:app --app-dir services/api --host 127.0.0.1 --port 8000` e, em outro terminal, `npm start`.

## O que funciona

- Início: receitas previstas, despesas, renda líquida, progresso e tempo comprometido.
- Trabalhos: criar, editar e excluir até seis fontes de renda; ganho líquido por unidade, minutos comprometidos, quantidade prevista e limite adicional.
- Despesas: criar, editar e excluir custos de cada mês, sem dupla contagem de custos por unidade.
- Meta: renda líquida desejada e horas totais disponíveis, incluindo atividades previstas.
- Otimizar: até três combinações distintas, classificadas por tempo, proximidade da meta e alternativa mista; resultados podem ser menos de três quando não existirem combinações distintas.
- Cenários salvos preservam entradas, resultado e versão do motor. Salvar não altera previsão nem registra recebimentos.
- Planejamentos independentes por mês, persistência em `localStorage` e exportação JSON de todos os meses.
- Exemplo fictício explicitamente marcado, removível pelo botão “Começar meu planejamento”.

## Cálculos e limites

Dinheiro em centavos inteiros e tempo em minutos inteiros. O ganho por unidade é líquido de custos e tributos informados manualmente pelo usuário. As despesas da aba Despesas são subtraídas uma vez da receita projetada. Sobreaviso usa todo o tempo comprometido. O motor desconta as horas previstas antes de buscar atividades adicionais e enumera até 500 mil combinações; limites maiores retornam erro orientando reduzir a busca, sem aproximar silenciosamente.

A meta impossível informa a receita incremental máxima dentro dos limites. A projeção acima da disponibilidade é sinalizada mesmo quando já alcança a meta. Os cenários pressupõem que haja demanda pelas atividades. Esta versão não modela calendário, conflitos, descanso, prontuário ou tributação oficial. Os valores são projeções, não comprovantes de receitas realizadas.

## Persistência e privacidade

Dados são guardados apenas neste navegador, sem sincronização entre dispositivos. O cálculo envia entradas à API FastAPI, que não grava em banco e não registra corpos das requisições. Não cadastrar dados de pacientes. Limpar o armazenamento do navegador apaga os dados; exporte cópias. A exportação JSON é uma cópia para consulta: importação/restauração pela interface ainda não foi implementada. Dados locais inválidos não são sobrescritos automaticamente.

## Verificação

```bash
npm run test:api
npm run typecheck
npm run build
# Com os dois servidores ativos e Chromium instalado:
npm run test:e2e
```

Os testes Playwright usam `/usr/bin/chromium`; é possível substituir via `CHROMIUM_PATH`. Cobrem os fluxos em 390px e 1440px. Os testes Python verificam cálculo exato, cenários mistos, horas existentes, meta impossível/alcançada, excesso de capacidade, validação e limites de busca.

## Próxima etapa

Após validar a experiência: autenticação gerenciada, PostgreSQL com isolamento por usuário, sincronização e recuperação de dados. Manifesto web e ícone estão incluídos; cache offline e aplicativo nativo ainda não foram implementados. O PRD completo em `docs/PRD.md` é referência para fases futuras, não uma declaração de funcionalidades entregues.
