# ADR-0009: TypeScript 6, ESLint e validação própria sobre o Zod

**Status:** aceita em 04/11/2026, na Fase 1.

## Contexto

O [ADR-0003](0003-monorepo-e-monolito-modular.md) deixou em aberto se o TypeScript 7 funcionaria com o NestJS e as ferramentas do Expo. A Fase 1 trouxe a resposta e outras duas incompatibilidades.

| Verificado                      | Resultado                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| `typescript-eslint` 8.72        | Exige TypeScript abaixo de 6.1                                                                  |
| Template oficial do NestJS 12   | Usa TypeScript 6.0 e Vitest                                                                     |
| Template oficial do Expo SDK 58 | Usa TypeScript 6.0                                                                              |
| `nestjs-zod` 5.5                | Declara suporte só até o NestJS 11, e o schema de resposta não apareceu no OpenAPI do NestJS 12 |
| Corepack 0.34 com pnpm 12       | Falha ao localizar o executável do pnpm                                                         |

## Decisão

- **TypeScript 6.0.3 em todo o monorepo**, fixado no catálogo do pnpm.
- **ESLint 10 com `typescript-eslint`**, para ter regras com informação de tipos, como `no-floating-promises`.
- **Camada própria sobre o Zod 4**, em `apps/api/src/validation/zod.ts`: `ZodPipe` valida a entrada, e `@ResponseSchema` documenta e confere a resposta. Um teste exige schema de resposta em toda rota.
- **pnpm sem Corepack:** `npx pnpm@12.16.1` ou instalação direta. O campo `packageManager` continua indicando a versão para o CI.

## Alternativas

- **TypeScript 7 com Oxlint:** o template do NestJS usa Oxlint, mas regras com informação de tipos são centrais para a segurança da API, e o restante do ecossistema ainda não está em TypeScript 7.
- **Manter o `nestjs-zod`:** a validação de toda entrada ficaria em um pacote sem suporte declarado à versão usada.

## Consequências

- A camada de validação tem cerca de 50 linhas e é nossa para manter.
- Voltar a avaliar o TypeScript 7 quando `typescript-eslint`, NestJS e Expo o suportarem.
