# ADR-0005: Autorização em duas camadas, RBAC e RLS

**Status:** proposta.

## Contexto

O prompt pede autorização checada em todo endpoint e RLS no banco. A API usará pool de conexões, então o contexto do usuário não pode vazar entre requisições.

## Decisão

1. **API:** guards verificam papel e posse do objeto em todo endpoint.
2. **Banco:** `FORCE ROW LEVEL SECURITY` em todas as tabelas com dados de usuário, e padrão de negar.
3. **Contexto:** cada requisição roda em transação com `set_config('app.user_id', $1, true)`. O escopo da transação limpa o valor ao final, inclusive com pool.
4. **Papéis de banco separados:** `escala_migrator`, `escala_app`, `escala_worker`, `escala_support` e `escala_analytics`. Nenhum papel de aplicação tem `BYPASSRLS`.
5. **Dados entre partes:** contato e endereço só por funções `SECURITY DEFINER` específicas, que validam o contrato vigente e gravam auditoria.

## Consequências

- Um erro em um guard não expõe dados de outro usuário, porque o banco ainda bloqueia.
- Cada requisição autenticada precisa de transação. Medir o custo na Fase 2.
- Toda coluna usada em política recebe índice.
- Testes de autorização rodam com o papel real `escala_app`, nunca com o dono das tabelas, que ignoraria parte das regras.
- Funções `SECURITY DEFINER` definem `search_path` fixo.
