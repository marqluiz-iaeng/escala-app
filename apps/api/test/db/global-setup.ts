import { randomBytes } from 'node:crypto';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { bootstrapDatabase } from '../../db/bootstrap-lib.js';
import { connectionUrl } from '../../db/config.js';
import { migrate } from '../../db/migrate-lib.js';
import { DB_ROLES, type DbRoleKey } from '../../db/roles.js';

const IMAGE = 'imresamu/postgis:18-3.6';
const DATABASE = 'escala_test';

export type DbTestContext = {
  host: string;
  port: number;
  database: string;
  admin: { user: string; password: string };
  passwords: Record<DbRoleKey, string>;
};

declare module 'vitest' {
  export interface ProvidedContext {
    db: DbTestContext;
  }
}

const secret = () => randomBytes(18).toString('hex');

export default async function setup(project: TestProject) {
  const admin = { user: 'escala_owner', password: secret() };
  const container = await new PostgreSqlContainer(IMAGE)
    .withDatabase('postgres')
    .withUsername(admin.user)
    .withPassword(admin.password)
    // Só em memória e sem garantias contra queda de energia: o banco morre com o teste.
    .withTmpFs({ '/var/lib/postgresql': 'rw' })
    .withCommand(['postgres', '-c', 'fsync=off', '-c', 'full_page_writes=off'])
    .start();

  const passwords = Object.fromEntries(
    (Object.keys(DB_ROLES) as DbRoleKey[]).map((key) => [key, secret()]),
  ) as Record<DbRoleKey, string>;
  const host = container.getHost();
  const port = container.getPort();

  await bootstrapDatabase({
    adminUrl: connectionUrl({ host, port, database: 'postgres', ...admin }),
    database: DATABASE,
    passwords,
  });
  await migrate({
    databaseUrl: connectionUrl({
      host,
      port,
      database: DATABASE,
      user: DB_ROLES.migrator,
      password: passwords.migrator,
    }),
    direction: 'up',
    silent: true,
  });

  project.provide('db', { host, port, database: DATABASE, admin, passwords });

  return async () => {
    await container.stop();
  };
}
