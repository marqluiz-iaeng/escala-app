import { getTableName, is, Table } from 'drizzle-orm';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, describe, expect, it } from 'vitest';
import * as schema from '../../src/db/generated/schema.js';
import { asApp, closePools, makeUser, system } from './helpers.js';

afterAll(closePools);

const tables = (Object.values(schema) as unknown[]).filter((value): value is PgTable =>
  is(value, Table),
);

describe('tipos gerados do Drizzle', () => {
  it('têm as mesmas tabelas e colunas do banco', async () => {
    const rows = await system<{ table_name: string; column_name: string }>(`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name <> 'pgmigrations'`);
    const inDatabase = rows.map((row) => `${row.table_name}.${row.column_name}`).sort();
    const inCode = tables
      .flatMap((table) => {
        const name = getTableName(table);
        return getTableConfig(table).columns.map((column) => `${name}.${column.name}`);
      })
      .sort();
    expect(inCode).toEqual(inDatabase);
  });

  it('consultam pelo papel da aplicação, com a RLS valendo', async () => {
    const ana = await makeUser();
    await makeUser();
    const rows = await asApp(ana, (client) =>
      drizzle(client).select({ id: schema.users.id }).from(schema.users),
    );
    expect(rows).toEqual([{ id: ana }]);
  });
});
