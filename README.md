# Escala

Marketplace mobile que conecta empresas a freelancers para turnos e trabalhos avulsos, com comunicação direta, suporte e reputação nos dois sentidos. O app não processa pagamentos: as partes acertam diretamente, e o Escala registra o combinado.

**Situação:** em construção, seguindo as fases de [docs/PLAN.md](docs/PLAN.md). Ainda não está pronto para dados reais.

## Como rodar

Requer Node 24 e pnpm 12. Sem pnpm instalado, troque `pnpm` por `npx pnpm@12.16.1` nos comandos abaixo.

```bash
pnpm install
```

```bash
pnpm setup:env
```

```bash
pnpm build
```

```bash
pnpm dev:api
```

Em outro terminal, abra o app na versão web, usada só para desenvolvimento:

```bash
pnpm --filter @escala/mobile web
```

Em um aparelho ou simulador, o app usa development build. Isso exige Xcode ou Android Studio, ou um build na nuvem pelo EAS.

### Serviços locais

PostgreSQL com PostGIS, Redis e uma caixa de e-mail local. Requer Docker ligado:

```bash
pnpm services:up
```

## Comandos

| Comando              | O que faz                                             |
| -------------------- | ----------------------------------------------------- |
| `pnpm verify`        | Roda formatação, lint, typecheck, testes e build      |
| `pnpm test`          | Roda os testes de todos os pacotes                    |
| `pnpm dev:api`       | API com recarga automática em `http://localhost:3000` |
| `pnpm dev:mobile`    | Servidor de desenvolvimento do Expo                   |
| `pnpm services:up`   | Sobe os serviços locais                               |
| `pnpm services:down` | Para os serviços locais                               |
| `pnpm db:setup`      | Cria os papéis do banco e aplica as migrações         |
| `pnpm db:seed`       | Cria os dados fictícios de demonstração               |
| `pnpm test:db`       | Testes de banco, em um PostgreSQL real (exige Docker) |

## Estrutura

```text
apps/api           API NestJS
apps/mobile        App Expo (iOS e Android)
packages/shared    Schemas e tipos compartilhados
packages/ui        Tokens do design system
legacy/prototype   Protótipo web, referência até a Fase 9
docs/              Plano, decisões, segurança e pendências jurídicas
```

## Documentação

- [Plano e modelo de dados](docs/PLAN.md)
- [Decisões técnicas](docs/adr/)
- [Suposições de produto](docs/ASSUMPTIONS.md)
- [Segurança](docs/SECURITY.md)
- [Pendências jurídicas](docs/LEGAL_TODO.md)
- [LGPD no protótipo](docs/LGPD.md)
- [Protótipo web](legacy/prototype/README.md)
