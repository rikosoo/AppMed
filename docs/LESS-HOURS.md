# Mesma renda com menos horas

O botão na página inicial abre automaticamente a comparação. Na aba Otimizar também é possível alternar entre aumentar renda e manter renda com menos horas. Não é necessário preencher outro formulário.

A referência é o planejamento do mês selecionado: quantidade prevista multiplicada pelo valor líquido por unidade. A renda líquida desconta todas as despesas cadastradas, que permanecem iguais nos cenários. Não é uma comparação com pagamentos recebidos nem com o valor da meta.

Uma opção só é mostrada se sua receita for igual ou maior que a atual e seu tempo total for estritamente menor. O cartão discrimina receita, despesas, renda líquida, horas anteriores, horas propostas, economia e quantidades por trabalho. As somas são feitas em centavos e minutos inteiros.

## Restrições

- Serviços mensais e trabalhos com limite extra zero permanecem fixos.
- Os demais podem diminuir até a quantidade já concluída e aumentar até a quantidade prevista mais seu limite extra. Serviços realizados nunca são retirados.
- O cenário inteiro respeita as horas disponíveis e o teto de 360h.
- Nenhum cenário altera automaticamente o planejamento, os serviços concluídos ou a meta.
- Nem sempre há três alternativas viáveis. Não são inventadas opções com menos renda ou sem economia de tempo para preencher os cartões.

## Algoritmo e validação

A primeira opção usa programação dinâmica limitada por tempo: para cada minuto viável, calcula a maior receita alcançável com as quantidades permitidas. Uma fila monotônica por resíduo de duração mantém cada solução em O(trabalhos × minutos), sem enumerar todas as combinações de quantidades. O primeiro tempo que alcança a receita de referência é o mínimo exato sob essas restrições.

As outras opções vêm de novas soluções exatas com cotas menores/maiores por trabalho. A seleção prioriza distância entre quantidades, rejeitando duplicatas e mudanças quase iguais. Essa exploração oferece variedade, mas não enumera todas as alternativas possíveis nem garante retornar três quando só existem alternativas muito parecidas.

Os testes comparam a solução principal com enumeração completa de 60 instâncias pequenas e conferem dinheiro, tempo, limites, serviços fixos, serviços realizados, ausência de solução e autorização da API. A interface é testada em celular/computador e entre 320 e 1440 pixels.

A simulação pressupõe que a demanda e a reorganização dos serviços sejam possíveis. Não verifica conflitos de agenda ou descanso entre jornadas.
