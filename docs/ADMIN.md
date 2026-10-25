# Administração e métricas — etapa 1

Esta etapa prepara o banco e as consultas protegidas. A tela visual administrativa será a etapa 2.

## Permissões

Toda conta nasce com papel `user`, inclusive a primeira. Não há senha administrativa padrão nem promoção pelo navegador. Para tornar uma conta existente administradora, execute na EC2, dentro do repositório:

```bash
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml exec api python manage_admin.py SEU_USUARIO
```

A operação fica registrada em `admin_audit`. As permissões são consultadas no banco em cada requisição; enviar um papel no navegador não concede acesso. Contas com status `blocked` não podem entrar e suas sessões deixam de autorizar operações. A interface para bloquear contas ainda não faz parte desta etapa.

## Consultas

- `GET /api/admin/metrics`: totais e métricas agregadas.
- `GET /api/admin/users?limit=50&offset=0`: lista paginada, limite máximo 100.

São endpoints internos da API, exigem sessão de administrador e não retornam senhas, tokens ou planejamentos financeiros. A interface Next será conectada a eles na próxima etapa.

## Definições

- **Total:** todas as contas cadastradas.
- **Habilitadas/bloqueadas:** situação da conta, independente de uso recente.
- **Novas em 7/30 dias:** data de criação dentro da janela móvel de 7/30 × 24 horas.
- **Ativas em 7/30 dias:** usuários distintos com planejamento salvo ou simulação concluída dentro da janela móvel. Login isolado não conta. Administradores que usam essas funções também contam.
- **Último login:** emissão de uma sessão, incluindo o cadastro inicial.
- **Última atividade:** última operação de uso concluída com sucesso.
- **Configuração concluída:** primeira persistência de um planejamento marcado como concluído. Importar um planejamento concluído também conta.
- **Eventos:** contagem de salvamentos e simulações; salvamentos automáticos também contam, portanto não representam número de sessões humanas.

Os eventos são agregados por usuário, tipo e dia UTC, sem nomes de trabalhos, valores financeiros, IP ou informações de dispositivo. Contagens de eventos usam os últimos 7/30 dias de calendário UTC incluindo hoje. `tracking_since` informa o primeiro dia com eventos; não há reconstrução de atividade anterior à implantação. O indicador de configuração concluída também começa nesta implantação. As datas de cadastro já existentes são preservadas.

A migração acrescenta colunas/tabelas sem apagar contas ou planejamentos. SQLite em volume persistente atende esta instância única; antes de trocar banco ou escalar para múltiplos servidores, será necessário planejar a migração.
