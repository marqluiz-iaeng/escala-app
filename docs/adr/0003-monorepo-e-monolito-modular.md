# ADR-0003: Monorepo e monolito modular em NestJS

**Status:** proposta.

## Contexto

São muitos domínios (identidade, vagas, contratos, chat, reputação, suporte) para um único produto, com tipos e schemas compartilhados entre app e API. O protótipo usa Express com rotas diretas.

## Decisão

- **Monorepo** com pnpm e Turborepo: `apps/mobile`, `apps/api`, `apps/admin`, `packages/ui` e `packages/shared`.
- **API como monolito modular em NestJS 12**, sobre Express. Um módulo só acessa outro pela interface pública.
- **Workers BullMQ** usam o mesmo código, em processo separado.

## Alternativas

- **Continuar em Express:** o código atual é pequeno, mas guards de autorização, gateway de WebSocket, filas e OpenAPI teriam de ser montados à mão.
- **Microsserviços:** custo operacional sem benefício nesta escala.
- **Supabase:** o prompt só o indica se já estivesse no projeto. Regras de negócio ficariam espalhadas entre funções e políticas.

## Consequências

- A execução direta de TypeScript pelo Node, usada hoje, não atende aos decorators do NestJS. A API passa a ter etapa de build.
- A compatibilidade dos decorators com o TypeScript 7 não foi confirmada. Validar no início da Fase 1. A alternativa é fixar a versão anterior e compilar com SWC.
- Regras de fronteira entre módulos serão verificadas por lint.
