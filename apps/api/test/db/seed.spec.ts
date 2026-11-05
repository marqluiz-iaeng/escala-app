import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateDictionary } from '../../db/dictionary-lib.js';
import { seedDev } from '../../db/seeds/seed-lib.js';
import { FieldVault, LocalKeyProvider, normalizeEmail } from '../../src/crypto/vault.js';
import { appRows, closePools, roleUrl, system } from './helpers.js';

afterAll(closePools);

const vault = new FieldVault(
  new LocalKeyProvider({
    NODE_ENV: 'test',
    FIELD_ENCRYPTION_KEYS: `k1:${randomBytes(32).toString('base64')}`,
    BLIND_INDEX_KEY: randomBytes(32).toString('base64'),
  }),
);

const input = () => ({ migratorUrl: roleUrl('migrator'), appUrl: roleUrl('app'), vault });

describe('seed de demonstração', () => {
  let anaId: string;

  beforeAll(async () => {
    await seedDev(input());
    const [ana] = await system<{ id: string }>(`SELECT id FROM users WHERE email_index = $1`, [
      vault.blindIndex(normalizeEmail('ana.demo@escala.invalid'), 'users.email'),
    ]);
    anaId = (ana as { id: string }).id;
  }, 60_000);

  it('roda de novo sem duplicar', async () => {
    const count = async () => {
      const [row] = await system<{ total: number }>(`SELECT count(*)::int AS total FROM users`);
      return row?.total;
    };
    const before = await count();
    expect(await seedDev(input())).toEqual({ created: false });
    expect(await count()).toBe(before);
  });

  it('percorre o fluxo inteiro pelo papel real da aplicação', async () => {
    const [contract] = await system<Record<string, unknown>>(
      `SELECT status, freelancer_confirmed_paid_at IS NOT NULL AS paid FROM contracts
       WHERE freelancer_id = $1`,
      [anaId],
    );
    expect(contract).toEqual({ status: 'completed', paid: true });
    const reviews = await system(
      `SELECT r.status FROM reviews r JOIN contracts c ON c.id = r.contract_id WHERE c.freelancer_id = $1`,
      [anaId],
    );
    expect(reviews).toEqual([{ status: 'published' }, { status: 'published' }]);
  });

  it('nenhum dado pessoal fica em claro no banco', async () => {
    const needles = [
      'Ana Moreira',
      'Marina Duarte',
      'Otávio Lima',
      'demo@escala.invalid',
      '+55',
      'Rua das Palmeiras',
      'Av. dos Festivais',
      'Vou chegar às 17h',
    ];
    const tables = await system<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'pgmigrations'`,
    );
    const found: string[] = [];
    for (const { tablename } of tables) {
      // Lê a linha inteira como texto, sem depender de saber as colunas.
      const rows = await system<{ line: string }>(
        `SELECT t::text AS line FROM public.${tablename} t`,
      );
      for (const { line } of rows) {
        for (const needle of needles) {
          if (line.includes(needle)) found.push(`${tablename}: ${needle}`);
        }
      }
    }
    expect(found).toEqual([]);
  });

  it('todo campo cifrado segue o formato e abre com a chave certa', async () => {
    const [user] = await system<{ email_enc: string; legal_name_enc: string }>(
      `SELECT email_enc, legal_name_enc FROM users WHERE id = $1`,
      [anaId],
    );
    expect(user?.email_enc).toMatch(/^v1\.k1\./);
    expect(vault.decrypt(user?.email_enc as string, 'users.email')).toBe('ana.demo@escala.invalid');
    expect(vault.decrypt(user?.legal_name_enc as string, 'users.legal_name')).toBe('Ana Moreira');
  });

  it('todas as colunas _enc, em todas as tabelas, têm só valores cifrados', async () => {
    const columns = await system<{ table_name: string; column_name: string }>(`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name LIKE '%\\_enc'`);
    const invalid: string[] = [];
    for (const { table_name, column_name } of columns) {
      const rows = await system<{ total: number }>(
        `SELECT count(*)::int AS total FROM public.${table_name}
         WHERE ${column_name} IS NOT NULL AND ${column_name} !~ '^v1\\.[a-z0-9-]+\\.'`,
      );
      if (rows[0]?.total) invalid.push(`${table_name}.${column_name}`);
    }
    expect(invalid).toEqual([]);
  });

  it('uma empresa sem relação não vê o contrato da demonstração', async () => {
    const [stranger] = await system<{ id: string }>(`SELECT id FROM users WHERE email_index = $1`, [
      vault.blindIndex(normalizeEmail('otavio.demo@escala.invalid'), 'users.email'),
    ]);
    expect(
      await appRows(stranger?.id as string, `SELECT id FROM contracts WHERE freelancer_id = $1`, [
        anaId,
      ]),
    ).toEqual([]);
  });
});

describe('dicionário de dados', () => {
  it('está em dia com o banco', async () => {
    const client = new Client({ connectionString: roleUrl('migrator') });
    await client.connect();
    try {
      const current = await generateDictionary(client);
      const committed = readFileSync(
        fileURLToPath(new URL('../../../../docs/DATA_DICTIONARY.md', import.meta.url)),
        'utf8',
      );
      expect(committed).toBe(current);
    } finally {
      await client.end();
    }
  });
});
