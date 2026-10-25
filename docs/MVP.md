# Escopo da primeira validação

A proposta de cinco telas do texto anexado tem prioridade nesta implementação sobre o roadmap extenso do PRD. O usuário escolheu começar localmente, sem Supabase, com usuário/senha fixos apenas para demonstração local.

Arquitetura: Next.js + TypeScript, CSS responsivo e Lucide; FastAPI com motor determinístico puro. PostgreSQL e autenticação ficam para uma próxima entrega. Enumeração limitada atende o tamanho do problema inicial sem OR-Tools. O frontend usa um proxy de mesma origem para a API.

Os cenários salvos são snapshots, não lançamentos. Não existe IA generativa nesta etapa. O primeiro acesso exige preenchimento guiado sem valores de exemplo. A sessão de demonstração não substitui autenticação real. Dados novos não são misturados entre competências.
