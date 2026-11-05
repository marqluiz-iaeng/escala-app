import { afterAll, describe, expect, it } from 'vitest';
import { APPLICATION_ROLES, DB_ROLES } from '../../db/roles.js';
import { as, closePools, DENIED, pool, system, withAdmin } from './helpers.js';

afterAll(closePools);

const USER_TABLES = `
  SELECT c.oid, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'pgmigrations'`;

const names = (rows: { name: string }[]) => rows.map((row) => row.name);

describe('regras de todas as tabelas', () => {
  it('toda tabela tem RLS ligada e forçada', async () => {
    const rows = await system<{ name: string }>(`
      SELECT t.relname AS name FROM (${USER_TABLES}) t
      JOIN pg_class c ON c.oid = t.oid
      WHERE NOT (c.relrowsecurity AND c.relforcerowsecurity)`);
    expect(names(rows)).toEqual([]);
  });

  it('o catálogo tem as tabelas do plano', async () => {
    const rows = await system(USER_TABLES);
    expect(rows.length).toBeGreaterThanOrEqual(55);
  });

  it('nenhuma coluna de ID usa outra coisa além de uuid v7', async () => {
    const rows = await system<{ name: string }>(`
      SELECT table_name || '.' || column_name AS name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'id' AND table_name <> 'pgmigrations'
        AND (data_type <> 'uuid' OR column_default IS DISTINCT FROM 'uuidv7()')`);
    expect(names(rows)).toEqual([]);
  });

  it('datas sempre com fuso, e nenhum dinheiro em ponto flutuante', async () => {
    const rows = await system<{ name: string }>(`
      SELECT table_name || '.' || column_name AS name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name <> 'pgmigrations' AND data_type IN
        ('timestamp without time zone', 'time with time zone', 'real', 'double precision', 'money')`);
    expect(names(rows)).toEqual([]);
  });

  it('colunas de centavos são sempre money_cents e vêm com moeda', async () => {
    const rows = await system<{ name: string }>(`
      SELECT c.table_name || '.' || c.column_name AS name FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.column_name LIKE '%\\_cents' AND (
        c.domain_name IS DISTINCT FROM 'money_cents' OR NOT EXISTS (
          SELECT 1 FROM information_schema.columns m
          WHERE m.table_schema = 'public' AND m.table_name = c.table_name AND m.domain_name = 'currency_code'
        )
      )`);
    expect(names(rows)).toEqual([]);
  });

  it('toda tabela tem as colunas padrão, e os registros de inclusão têm occurred_at', async () => {
    const rows = await system<{ name: string }>(`
      SELECT t.relname AS name FROM (${USER_TABLES}) t
      WHERE NOT EXISTS (
          SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema = 'public' AND c.table_name = t.relname AND c.column_name = 'updated_at'
        )
        AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema = 'public' AND c.table_name = t.relname AND c.column_name = 'occurred_at'
        )`);
    expect(names(rows)).toEqual([]);
  });

  it('tabelas com updated_at têm o gatilho que a mantém', async () => {
    const rows = await system<{ name: string }>(`
      SELECT c.table_name AS name FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.column_name = 'updated_at' AND NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        WHERE t.tgrelid = ('public.' || quote_ident(c.table_name))::regclass
          AND t.tgname = c.table_name || '_set_updated_at'
      )`);
    expect(names(rows)).toEqual([]);
  });

  it('toda chave estrangeira tem índice, exceto created_by', async () => {
    // created_by só é usado em auditoria, e contas nunca são apagadas fisicamente.
    const rows = await system<{ name: string }>(`
      SELECT c.conrelid::regclass::text || '.' || a.attname AS name
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
        AND a.attname <> 'created_by'
        AND NOT EXISTS (
          SELECT 1 FROM pg_index i
          WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1] AND i.indpred IS NULL
        )`);
    expect(names(rows)).toEqual([]);
  });

  it('toda tabela e toda coluna sensível têm comentário', async () => {
    const tables = await system<{ name: string }>(`
      SELECT t.relname AS name FROM (${USER_TABLES}) t WHERE obj_description(t.oid) IS NULL`);
    expect(names(tables)).toEqual([]);

    const columns = await system<{ name: string }>(`
      SELECT t.relname || '.' || a.attname AS name
      FROM (${USER_TABLES}) t JOIN pg_attribute a ON a.attrelid = t.oid
      WHERE a.attnum > 0 AND NOT a.attisdropped
        AND (a.attname LIKE '%\\_enc' OR a.attname LIKE '%\\_index')
        AND col_description(t.oid, a.attnum) IS NULL`);
    expect(names(columns)).toEqual([]);
  });

  it('colunas cifradas são texto, e índices cegos têm valor único', async () => {
    const encrypted = await system<{ name: string }>(`
      SELECT table_name || '.' || column_name AS name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name LIKE '%\\_enc' AND data_type <> 'text'`);
    expect(names(encrypted)).toEqual([]);

    const blind = await system<{ name: string }>(`
      SELECT t.relname || '.' || a.attname AS name
      FROM (${USER_TABLES}) t JOIN pg_attribute a ON a.attrelid = t.oid
      WHERE a.attname LIKE '%\\_index' AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = t.oid AND i.indisunique AND i.indkey[0] = a.attnum AND i.indnatts = 1
      )`);
    expect(names(blind)).toEqual([]);
  });

  it('tabelas somente de inclusão têm o gatilho que impede alterar', async () => {
    const appendOnly = [
      'consents',
      'audit_logs',
      'job_status_history',
      'application_status_history',
      'contract_status_history',
      'shift_status_history',
      'dispute_status_history',
      'ticket_status_history',
    ];
    const rows = await system<{ name: string }>(
      `SELECT c.relname AS name FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
       WHERE t.tgname = c.relname || '_append_only' ORDER BY 1`,
    );
    expect(names(rows).sort()).toEqual([...appendOnly].sort());
  });
});

describe('papéis de banco', () => {
  it('nenhum papel de aplicação ignora a RLS nem tem poderes de administração', async () => {
    const rows = await withAdmin(undefined, async (client) => {
      const { rows: found } = await client.query<{
        rolname: string;
        rolsuper: boolean;
        rolbypassrls: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
      }>(
        `SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles
         WHERE rolname = ANY($1)`,
        [APPLICATION_ROLES.map((key) => DB_ROLES[key])],
      );
      return found;
    });
    expect(rows).toHaveLength(APPLICATION_ROLES.length);
    for (const role of rows) {
      expect(role).toMatchObject({
        rolsuper: false,
        rolbypassrls: false,
        rolcreatedb: false,
        rolcreaterole: false,
      });
    }
  });

  it('o papel de migração não é superusuário', async () => {
    const [row] = await system<{ rolsuper: boolean }>(
      `SELECT rolsuper FROM pg_roles WHERE rolname = current_user`,
    );
    expect(row).toEqual({ rolsuper: false });
  });

  it.each(APPLICATION_ROLES)('%s não cria tabela nem função', async (key) => {
    await expect(
      as(key, null, (client) => client.query(`CREATE TABLE public.invasao (id int)`)),
    ).rejects.toMatchObject(DENIED);
    await expect(
      as(key, null, (client) =>
        client.query(`CREATE FUNCTION app.invasao() RETURNS int LANGUAGE sql AS 'SELECT 1'`),
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it.each(APPLICATION_ROLES)('%s não lê a tabela de migrações', async (key) => {
    await expect(pool(key).query(`SELECT * FROM public.pgmigrations`)).rejects.toMatchObject(
      DENIED,
    );
  });

  it('o suporte não tem acesso direto a dados pessoais e conversas', async () => {
    const [row] = await system<Record<string, boolean>>(`
      SELECT
        has_table_privilege('escala_support', 'public.users', 'SELECT') AS users,
        has_table_privilege('escala_support', 'public.messages', 'SELECT') AS messages,
        has_table_privilege('escala_support', 'public.job_private_details', 'SELECT') AS job_private,
        has_table_privilege('escala_support', 'public.check_ins', 'SELECT') AS check_ins,
        has_table_privilege('escala_support', 'public.applications', 'SELECT') AS applications`);
    expect(row).toEqual({
      users: false,
      messages: false,
      job_private: false,
      check_ins: false,
      applications: false,
    });
  });

  it('o papel de análise não enxerga nenhuma tabela de public', async () => {
    const rows = await system<{ name: string }>(`
      SELECT t.relname AS name FROM (${USER_TABLES}) t
      WHERE has_table_privilege('escala_analytics', t.oid, 'SELECT')
        OR has_any_column_privilege('escala_analytics', t.oid, 'SELECT')`);
    expect(names(rows)).toEqual([]);
  });

  it('as visões de análise não têm colunas pessoais', async () => {
    const rows = await system<{ name: string }>(`
      SELECT table_name || '.' || column_name AS name FROM information_schema.columns
      WHERE table_schema = 'analytics' AND (
        column_name LIKE '%\\_enc' OR column_name LIKE '%\\_index' OR column_name LIKE '%user\\_id'
        OR column_name LIKE '%freelancer\\_id' OR column_name LIKE '%location%'
        OR column_name IN ('email', 'phone', 'name', 'display_name', 'address')
      )`);
    expect(names(rows)).toEqual([]);
  });

  it('o worker não lê conversas nem credenciais', async () => {
    const [row] = await system<Record<string, boolean>>(`
      SELECT
        has_table_privilege('escala_worker', 'public.messages', 'SELECT') AS messages,
        has_table_privilege('escala_worker', 'public.refresh_tokens', 'SELECT') AS tokens,
        has_table_privilege('escala_worker', 'public.mfa_factors', 'SELECT') AS mfa,
        has_table_privilege('escala_worker', 'public.otp_codes', 'SELECT') AS otp`);
    expect(row).toEqual({ messages: false, tokens: false, mfa: false, otp: false });
  });

  it('o app não lê códigos, tokens nem segundo fator', async () => {
    const [row] = await system<Record<string, boolean>>(`
      SELECT
        has_any_column_privilege('escala_app', 'public.otp_codes', 'SELECT') AS otp,
        has_any_column_privilege('escala_app', 'public.refresh_tokens', 'SELECT') AS tokens,
        has_any_column_privilege('escala_app', 'public.mfa_factors', 'SELECT') AS mfa`);
    expect(row).toEqual({ otp: false, tokens: false, mfa: false });
  });

  it('o login não acessa contratos, conversas nem perfis', async () => {
    const [row] = await system<Record<string, boolean>>(`
      SELECT
        has_any_column_privilege('escala_auth', 'public.contracts', 'SELECT') AS contracts,
        has_any_column_privilege('escala_auth', 'public.messages', 'SELECT') AS messages,
        has_any_column_privilege('escala_auth', 'public.freelancer_profiles', 'SELECT') AS profiles`);
    expect(row).toEqual({ contracts: false, messages: false, profiles: false });
  });

  it('nem o login nem o app conseguem promover alguém a suporte', async () => {
    for (const role of ['escala_app', 'escala_auth']) {
      const [row] = await system<Record<string, boolean>>(
        `SELECT
           has_column_privilege($1, 'public.users', 'platform_role', 'INSERT') AS can_insert,
           has_column_privilege($1, 'public.users', 'platform_role', 'UPDATE') AS can_update`,
        [role],
      );
      expect(row).toEqual({ can_insert: false, can_update: false });
    }
  });
});

describe('funções', () => {
  it('toda função que roda como dono fixa o search_path', async () => {
    const rows = await system<{ name: string }>(`
      SELECT p.oid::regprocedure::text AS name FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'app' AND p.prosecdef
        AND NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')`);
    expect(names(rows)).toEqual([]);
  });

  it('nenhuma função é executável por PUBLIC', async () => {
    const rows = await system<{ name: string }>(`
      SELECT p.oid::regprocedure::text AS name FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'app' AND has_function_privilege('public', p.oid, 'EXECUTE')`);
    expect(names(rows)).toEqual([]);
  });

  it('função nova também nasce sem permissão para PUBLIC', async () => {
    const client = await pool('migrator').connect();
    try {
      await client.query('BEGIN');
      await client.query(`CREATE FUNCTION app.nova() RETURNS int LANGUAGE sql AS 'SELECT 1'`);
      const { rows } = await client.query<{ allowed: boolean }>(
        `SELECT has_function_privilege('escala_app', 'app.nova()', 'EXECUTE') AS allowed`,
      );
      expect(rows[0]).toEqual({ allowed: false });
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('as operações privilegiadas não ficam disponíveis para o app', async () => {
    for (const signature of [
      'app.erase_user(uuid)',
      'app.close_company(uuid)',
      'app.purge_expired_data()',
      'app.support_read_user(uuid,text)',
      'app.support_read_messages(uuid,text)',
    ]) {
      const [row] = await system<{ allowed: boolean }>(
        `SELECT has_function_privilege('escala_app', $1::regprocedure, 'EXECUTE') AS allowed`,
        [signature],
      );
      expect(row, signature).toEqual({ allowed: false });
    }
  });
});
