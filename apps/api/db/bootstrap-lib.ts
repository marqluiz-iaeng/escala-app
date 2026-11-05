import { Client, escapeIdentifier, escapeLiteral } from 'pg';
import { APPLICATION_ROLES, DB_ROLES, type DbRoleKey } from './roles.js';

export type BootstrapInput = {
  /** Conexão de administrador. Só o bootstrap usa, nunca a aplicação. */
  adminUrl: string;
  database: string;
  passwords: Record<DbRoleKey, string>;
};

async function ensureRole(client: Client, role: string, attributes: string, password: string) {
  const exists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
  const verb = exists.rowCount ? 'ALTER' : 'CREATE';
  await client.query(
    `${verb} ROLE ${escapeIdentifier(role)} ${attributes} PASSWORD ${escapeLiteral(password)}`,
  );
}

/**
 * Prepara o que migrações não podem fazer sozinhas: papéis, dono do banco e extensões,
 * que exigem administrador. Pode rodar mais de uma vez.
 */
export async function bootstrapDatabase(input: BootstrapInput): Promise<void> {
  const admin = new Client({ connectionString: input.adminUrl });
  await admin.connect();
  try {
    await ensureRole(
      admin,
      DB_ROLES.migrator,
      'LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS',
      input.passwords.migrator,
    );
    for (const key of APPLICATION_ROLES) {
      await ensureRole(
        admin,
        DB_ROLES[key],
        'LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS',
        input.passwords[key],
      );
    }

    const database = escapeIdentifier(input.database);
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      input.database,
    ]);
    if (!exists.rowCount) {
      // template0 vem limpo. O template padrão e o banco criado pela imagem podem trazer
      // extensões instaladas em public, que é justamente o que queremos evitar.
      await admin.query(
        `CREATE DATABASE ${database} OWNER ${DB_ROLES.migrator} TEMPLATE template0 ENCODING 'UTF8'`,
      );
    } else {
      await admin.query(`ALTER DATABASE ${database} OWNER TO ${DB_ROLES.migrator}`);
    }
    await admin.query(`REVOKE ALL ON DATABASE ${database} FROM PUBLIC`);
    for (const role of Object.values(DB_ROLES)) {
      await admin.query(`GRANT CONNECT ON DATABASE ${database} TO ${role}`);
      await admin.query(`ALTER ROLE ${role} SET search_path = public, extensions`);
    }
    // Uma requisição travada não pode segurar conexões nem bloqueios indefinidamente.
    for (const key of ['app', 'auth', 'support'] as const) {
      await admin.query(`ALTER ROLE ${DB_ROLES[key]} SET statement_timeout = '15s'`);
      await admin.query(
        `ALTER ROLE ${DB_ROLES[key]} SET idle_in_transaction_session_timeout = '30s'`,
      );
    }
  } finally {
    await admin.end();
  }

  const url = new URL(input.adminUrl);
  url.pathname = `/${input.database}`;
  const target = new Client({ connectionString: url.toString() });
  await target.connect();
  try {
    await target.query(`ALTER SCHEMA public OWNER TO ${DB_ROLES.migrator}`);
    await target.query('REVOKE ALL ON SCHEMA public FROM PUBLIC');
    await target.query('CREATE SCHEMA IF NOT EXISTS extensions');
    await target.query('REVOKE ALL ON SCHEMA extensions FROM PUBLIC');
    const installed = await target.query<{ schema: string }>(
      `SELECT n.nspname AS schema FROM pg_extension e
       JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'postgis'`,
    );
    if (installed.rows[0] && installed.rows[0].schema !== 'extensions') {
      // Sem isto, o IF NOT EXISTS abaixo passaria em silêncio e as migrações falhariam depois.
      throw new Error(
        `O PostGIS deste banco está no esquema ${installed.rows[0].schema}. Use um banco novo.`,
      );
    }
    // Fora de public: a tabela spatial_ref_sys do PostGIS não pode ter RLS e não contém dados de usuários.
    await target.query('CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions');
    for (const role of Object.values(DB_ROLES)) {
      await target.query(`GRANT USAGE ON SCHEMA extensions TO ${role}`);
      await target.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
      await target.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO ${role}`);
    }
  } finally {
    await target.end();
  }
}
