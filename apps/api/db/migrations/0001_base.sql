-- Up Migration

-- Funções internas ficam em app; visões sem dados pessoais, em analytics.
CREATE SCHEMA app;
CREATE SCHEMA analytics;

-- Dinheiro é sempre inteiro em centavos, com moeda. Nunca float.
CREATE DOMAIN money_cents AS bigint CHECK (VALUE >= 0);
CREATE DOMAIN currency_code AS text DEFAULT 'BRL' CHECK (VALUE ~ '^[A-Z]{3}$');

COMMENT ON DOMAIN money_cents IS 'Valor em centavos, nunca negativo.';
COMMENT ON DOMAIN currency_code IS 'Código de moeda ISO 4217.';

-- Quem é o usuário desta requisição. Definido por transação com set_config('app.user_id', ..., true).
CREATE FUNCTION app.current_user_id() RETURNS uuid
  LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(pg_catalog.current_setting('app.user_id', true), '')::uuid
$$;

CREATE FUNCTION app.set_updated_at() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

-- Tabelas somente de inclusão. Com dois argumentos (coluna, prazo), permite apagar o que já venceu.
CREATE FUNCTION app.forbid_mutation() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND TG_NARGS = 2
     AND (pg_catalog.to_jsonb(OLD) ->> TG_ARGV[0])::timestamptz
         < pg_catalog.now() - TG_ARGV[1]::interval THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% é somente inclusão', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END;
$$;

-- Down Migration

DROP FUNCTION app.forbid_mutation();
DROP FUNCTION app.set_updated_at();
DROP FUNCTION app.current_user_id();
DROP DOMAIN currency_code;
DROP DOMAIN money_cents;
DROP SCHEMA analytics;
DROP SCHEMA app;
