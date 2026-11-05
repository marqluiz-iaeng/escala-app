# ADR-0010: Serviços locais de desenvolvimento

**Status:** aceita em 04/11/2026, na Fase 1.

## Contexto

O plano previa `postgis/postgis` e MinIO. Ao fixar as versões, encontrei dois problemas:

- A imagem `postgis/postgis:18-3.6` só existe para `amd64`, e a máquina de desenvolvimento é `arm64`. Rodaria emulada, com o banco mais lento.
- O [repositório do MinIO](https://github.com/minio/minio) está arquivado.

## Decisão

- **PostgreSQL:** `imresamu/postgis:18-3.6`, multiarquitetura, mantida por um dos responsáveis pela imagem oficial. Só para desenvolvimento e testes.
- **Arquivos compatíveis com S3:** [SeaweedFS](https://github.com/seaweedfs/seaweedfs) (Apache-2.0, ativo). Entra no Compose na fase que tiver os primeiros uploads, e é validado nela.
- **Compose só com o que já é usado:** PostgreSQL, Redis e Mailpit, todos presos a `127.0.0.1`.

## Consequências

- Em produção, o plano continua sendo PostgreSQL gerenciado e S3 ([decisão D5](../PLAN.md)).
- A imagem de PostgreSQL de desenvolvimento vem de um namespace pessoal. O PostGIS real foi conferido nos testes de integração da Fase 2.
- A imagem instala o PostGIS e outras extensões no esquema `public` do banco que ela cria, e isso conflita com a instalação em `extensions`. Por isso, no Compose esse banco é só o `postgres`, de administração. O banco do app é criado a partir do `template0` pelo `pnpm db:setup`, e o bootstrap falha com uma mensagem clara se encontrar o PostGIS em outro esquema.
- O código de arquivos usa a interface S3, então trocar o SeaweedFS não afeta a aplicação.
