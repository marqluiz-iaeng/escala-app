import { readdirSync } from 'node:fs';
import type { Client } from 'pg';
import { describe, expect, inject, it } from 'vitest';
import { bootstrapDatabase } from '../../db/bootstrap-lib.js';
import { migrate, MIGRATIONS_DIR } from '../../db/migrate-lib.js';
import { adminConnectionUrl, roleUrl, withAdmin } from './helpers.js';

const DATABASE = 'escala_roundtrip';

/** Tudo o que define o esquema, em texto ordenado: dois bancos iguais geram o mesmo retrato. */
async function schemaSnapshot(client: Client): Promise<Record<string, unknown[]>> {
  const queries: Record<string, string> = {
    columns: `
      SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema IN ('public', 'app', 'analytics') AND table_name <> 'pgmigrations'
      ORDER BY 1, 2, 3`,
    constraints: `
      SELECT c.conrelid::regclass::text AS tbl, c.conname, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname IN ('public', 'app') AND c.conrelid::regclass::text <> 'pgmigrations'
      ORDER BY 1, 2`,
    indexes: `
      SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes
      WHERE schemaname IN ('public', 'app') AND tablename <> 'pgmigrations'
      ORDER BY 1, 2, 3`,
    policies: `
      SELECT tablename, policyname, cmd, roles::text, qual, with_check FROM pg_policies
      WHERE schemaname = 'public' ORDER BY 1, 2`,
    triggers: `
      SELECT c.relname, t.tgname, pg_get_triggerdef(t.oid) AS def
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE NOT t.tgisinternal AND n.nspname = 'public' ORDER BY 1, 2`,
    functions: `
      SELECT p.oid::regprocedure::text AS name, pg_get_functiondef(p.oid) AS def,
        array(SELECT unnest(p.proacl)::text ORDER BY 1) AS acl
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'app' ORDER BY 1`,
    types: `
      SELECT t.typname, array(SELECT e.enumlabel FROM pg_enum e WHERE e.enumtypid = t.oid ORDER BY e.enumsortorder) AS labels
      FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd') ORDER BY 1`,
    tables: `
      SELECT c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
        array(SELECT unnest(c.relacl)::text ORDER BY 1) AS acl,
        (SELECT array_agg(a.attname || '=' || a.attacl::text ORDER BY a.attname)
           FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attacl IS NOT NULL) AS column_acl,
        obj_description(c.oid) AS comment
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'analytics') AND c.relkind IN ('r', 'v') AND c.relname <> 'pgmigrations'
      ORDER BY 1`,
  };
  const snapshot: Record<string, unknown[]> = {};
  for (const [name, sql] of Object.entries(queries)) {
    snapshot[name] = (await client.query(sql)).rows;
  }
  return snapshot;
}

describe('migrações', () => {
  it('sobem, descem até o início e sobem de novo com o mesmo resultado', async () => {
    const ctx = inject('db');
    await bootstrapDatabase({
      adminUrl: adminConnectionUrl(),
      database: DATABASE,
      passwords: ctx.passwords,
    });
    // Pode rodar mais de uma vez.
    await bootstrapDatabase({
      adminUrl: adminConnectionUrl(),
      database: DATABASE,
      passwords: ctx.passwords,
    });
    const databaseUrl = roleUrl('migrator', DATABASE);
    const total = readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.sql')).length;

    const up = await migrate({ databaseUrl, direction: 'up', silent: true });
    expect(up).toHaveLength(total);
    const first = await withAdmin(DATABASE, schemaSnapshot);
    expect(first.tables?.length).toBeGreaterThan(50);

    const down = await migrate({ databaseUrl, direction: 'down', count: total, silent: true });
    expect(down).toHaveLength(total);
    await withAdmin(DATABASE, async (client) => {
      const left = await client.query(`
        SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname NOT LIKE 'pgmigrations%'`);
      expect(left.rows).toEqual([]);
      const schemas = await client.query(
        `SELECT nspname FROM pg_namespace WHERE nspname IN ('app', 'analytics')`,
      );
      expect(schemas.rows).toEqual([]);
      const types = await client.query(`
        SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd')`);
      expect(types.rows).toEqual([]);
    });

    await migrate({ databaseUrl, direction: 'up', silent: true });
    expect(await withAdmin(DATABASE, schemaSnapshot)).toEqual(first);

    // E não há nada pendente depois disso.
    expect(await migrate({ databaseUrl, direction: 'up', silent: true })).toEqual([]);
  }, 180_000);
});
