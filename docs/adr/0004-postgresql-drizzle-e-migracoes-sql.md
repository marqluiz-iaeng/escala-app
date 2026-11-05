# ADR-0004: PostgreSQL 18, Drizzle e migrações em SQL

**Status:** aceita.

## Contexto

O prompt exige RLS, PostGIS, UUID v7, migrações versionadas e, como critério da Fase 2, migrações que "sobem e descem". O SQLite do protótipo não atende.

## Decisão

- **PostgreSQL 18 com PostGIS 3.6.** A versão 18 tem `uuidv7()` nativo.
- **`node-pg-migrate` com arquivos SQL** é a única fonte das migrações, com up e down. Um teste roda up, down e up de novo.
- **Drizzle só para consultas tipadas.** O esquema TypeScript é conferido contra o banco no CI, para detectar divergência.

## Alternativas

- **Migrações do `drizzle-kit`:** a [documentação](https://orm.drizzle.team/docs/migrations) descreve geração e aplicação, sem comando de reversão. Também teríamos muito SQL manual em políticas e gatilhos.
- **Prisma:** tem suporte menos direto a PostGIS e RLS, e o foco deste modelo está no banco.
- **`pgcrypto` e funções no banco para tudo:** concentra regra de negócio em SQL e dificulta testes (ver [ADR-0006](0006-criptografia-por-campo.md)).

## Consequências

- Duas definições do esquema, SQL e TypeScript, mantidas em sincronia pelo teste de divergência.
- O `drizzle-kit pull` não reconhece `geography`, domínios nem `tsvector`, e escreve o texto vazio padrão de um jeito que não compila. O `db:pull` corrige isso com os tipos de `src/db/column-types.ts`, e falha se aparecer um tipo novo sem mapeamento. Validado na Fase 2.
- O teste de divergência compara as tabelas e colunas do esquema gerado com o catálogo do banco.
- O Drizzle ainda está em versão 0.x. O acesso a dados fica isolado para limitar o impacto de mudanças.
- Os testes usam PostgreSQL real em contêiner, então o Docker precisa estar ligado. O banco de teste roda em memória (`tmpfs`): é mais rápido e não ocupa disco a cada execução.
- A disponibilidade do PostgreSQL 18 em `sa-east-1` ainda precisa ser confirmada na Fase 10.
