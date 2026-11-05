# ADR-0011: Papel de banco separado para o login

**Status:** aceita.

## Contexto

A [ADR-0005](0005-autorizacao-rbac-e-rls.md) previa quatro papéis de aplicação. Na hora de escrever as políticas, apareceu um caso que eles não cobrem: o login acontece antes de existir uma pessoa na requisição.

Para entrar, a API precisa procurar uma conta pelo índice do e-mail, criar a conta, gravar códigos de uso único e renovar tokens. Tudo isso sem `app.user_id`, que é o que as políticas de `escala_app` usam para liberar uma linha.

## Decisão

Criar o papel `escala_auth`, usado só pelo módulo de login:

- Vê todas as linhas das tabelas de identidade: `users`, `auth_identities`, `otp_codes`, `mfa_factors`, `devices`, `sessions` e `refresh_tokens`.
- Registra consentimentos e auditoria. Lê documentos legais, flags e ajuda.
- **Não acessa** contratos, conversas, perfis, vagas ou arquivos.
- **Não altera** `platform_role`: o login nunca promove ninguém.

O inverso também vale: `escala_app` não lê códigos, tokens nem segundos fatores.

## Alternativas

- **Funções `SECURITY DEFINER` para cada passo do login:** daria um controle fino, mas espalharia a regra de negócio do login por dezenas de funções SQL, sem ganho real, porque o papel já fica restrito às mesmas tabelas.
- **Liberar as tabelas de identidade para `escala_app`:** qualquer falha em uma rota comum poderia ler a tabela inteira de contas ou de tokens. É o risco que as camadas existem para evitar.

## Consequências

- Uma falha em uma rota comum não alcança tokens nem códigos.
- Uma falha no login alcança dados de identidade, que são cifrados, mas não contratos e conversas.
- A Fase 3 precisa de dois pools de conexão: um para o login e um para o restante.
