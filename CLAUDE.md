# Escala

Marketplace mobile que conecta empresas a freelancers para turnos e trabalhos avulsos.

## Comece por aqui

- [docs/PLAN.md](docs/PLAN.md): plano aprovado, modelo de dados e fases. Sempre confira em que fase estamos.
- [docs/adr/](docs/adr/): decisões técnicas. Registre aqui cada nova decisão relevante.
- [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md): suposições de produto. Na dúvida, escolha a opção mais segura para o usuário e registre.

## Regras que não mudam

- **Sem pagamentos no app.** O app não cobra, não retém nem repassa dinheiro ([ADR-0001](docs/adr/0001-sem-pagamentos-no-app.md)). Ignore as menções a pagamento em `docs/PROMPT_ESCALA.md`.
- **Fase por fase.** No fim de cada uma: lint, typecheck, testes, commit convencional (`feat:`, `fix:`, `chore:`) e resumo do que foi feito e do que falta.
- **Sem segredos no código.** Use `.env` e `.env.example`. Sem credencial, crie a integração com mock e avise.
- **Sem infraestrutura nova sem aprovação.** Até a Fase 9, tudo roda localmente.
- **Toda rota da API tem schema de entrada e de resposta**, com `ZodPipe` e `@ResponseSchema`.
- **Dados pessoais nunca vão para logs**, URLs ou mensagens de erro.
- **Autorização no servidor, sempre.** Teste que uma pessoa não acessa dados de outra.
- **Toda tela tem os estados** de carregando, vazio, erro e sucesso.

## Estrutura

```text
apps/api           API e workers NestJS 12, em ESM
apps/mobile        App Expo SDK 58
packages/shared    Schemas Zod e tipos compartilhados
packages/ui        Tokens do design system
legacy/prototype   Protótipo web. Referência até a Fase 9. Não adicione funcionalidades
docs/              Plano, ADRs e regras
```

Pacotes em `packages/` são consumidos pelo `dist/`. Depois de alterá-los, rode o `build` deles ou `pnpm --filter <pacote> dev`.

## Comandos

```bash
pnpm install
pnpm setup:env
pnpm verify
pnpm services:up
pnpm db:setup
pnpm db:seed
pnpm dev:api
pnpm dev:mobile
pnpm --filter @escala/mobile web
```

`pnpm verify` roda formatação, lint, typecheck, testes, testes de banco e build. Os testes de banco (`pnpm test:db`) exigem o Docker ligado. Sem pnpm instalado, use `npx pnpm@12.16.1`. Não use Corepack ([ADR-0009](docs/adr/0009-typescript-6-eslint-e-validacao-propria.md)).

## Convenções

- TypeScript 6 em todo o monorepo, com versões compartilhadas no catálogo de `pnpm-workspace.yaml`.
- A API é ESM: imports relativos terminam em `.js`.
- Na API, não use `import type` em dependências injetadas: o NestJS precisa do tipo em tempo de execução.
- Textos do produto e da documentação em português do Brasil, em linguagem simples.
- Banco: migrações em SQL em `apps/api/db/migrations`, sempre com `Up` e `Down`. Toda tabela nova precisa de RLS, política, permissão por coluna e comentário. Depois de alterar o esquema, rode `pnpm --filter @escala/api db:dictionary` e `db:pull`, que geram o dicionário e os tipos do Drizzle.
- Testes de banco usam os papéis reais (`escala_app` etc.), nunca o dono das tabelas, que ignora a RLS.
- Toda consulta de requisição passa por `withUser`, que define a pessoa logada só para aquela transação.
