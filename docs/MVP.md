# Escopo da primeira validação

A proposta de cinco telas do texto anexado tem prioridade nesta implementação sobre o roadmap extenso do PRD. O usuário escolheu começar localmente, sem Supabase, com usuário/senha fixos apenas para demonstração local.

Arquitetura: Next.js + TypeScript, CSS responsivo e Lucide; FastAPI com motor determinístico puro. PostgreSQL e autenticação ficam para uma próxima entrega. Enumeração limitada atende o tamanho do problema inicial sem OR-Tools. O frontend usa um proxy de mesma origem para a API.

Os cenários salvos são snapshots, não lançamentos. Não existe IA generativa nesta etapa. O primeiro acesso exige preenchimento guiado sem valores de exemplo. A sessão de demonstração não substitui autenticação real. Dados novos não são misturados entre competências.

O cadastro de trabalho agora recebe bruto e PF/PJ, com desconto fixo estimado de 27%/15%, arredondado por unidade em centavos. Entradas legadas líquidas não recebem desconto duplicado. A API valida a consistência dos valores. Mês novo oferece revisão, reaproveitamento explícito ou cadastro do zero; os meses e snapshots anteriores permanecem separados.

Disponibilidade limitada a 360h/mês. Quando os limites atuais impedem a meta, há até três alternativas ampliadas para cobrir o valor que falta. A primeira minimiza horas adicionais por programação dinâmica; as demais exploram mixes distintos. Não é necessário ocupar 360h: esse é o teto total. Somente essas alternativas podem exceder limites positivos de unidades, com detalhes explícitos. Limite zero continua excluindo a atividade. Os cartões mostram horas necessárias e excesso de disponibilidade, sem aplicar ou salvar automaticamente.

O motor 1.8 mantém a primeira recomendação ótima e escolhe as demais pela diversidade das atividades e por alterações relevantes nas quantidades. Combinações ampliadas usam cotas de renda entre trabalhos e retiram unidades desnecessárias para a meta, evitando diferenças artificiais de apenas uma telemedicina extra. Os mixes alternativos podem demandar mais tempo ou render menos; os cartões mostram os totais reais. A diversidade das alternativas é heurística, enquanto a primeira solução ampliada mantém o mínimo de tempo exato (ou maior alcance se a meta for impossível).
