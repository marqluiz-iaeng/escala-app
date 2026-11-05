import { DB_ROLES, PASSWORD_ENV, type DbRoleKey } from './roles.js';

export type DbConfig = {
  host: string;
  port: number;
  database: string;
  admin: { user: string; password: string };
  passwords: Record<DbRoleKey, string>;
};

function required(source: NodeJS.ProcessEnv, name: string): string {
  const value = source[name];
  // A mensagem cita só o nome da variável, nunca um valor.
  if (!value) throw new Error(`Falta a variável ${name}. Rode pnpm setup:env.`);
  return value;
}

export function loadDbConfig(source: NodeJS.ProcessEnv = process.env): DbConfig {
  const passwords = Object.fromEntries(
    (Object.keys(PASSWORD_ENV) as DbRoleKey[]).map((key) => [
      key,
      required(source, PASSWORD_ENV[key]),
    ]),
  ) as Record<DbRoleKey, string>;
  return {
    host: source.POSTGRES_HOST ?? '127.0.0.1',
    port: Number(source.POSTGRES_PORT ?? 5432),
    database: required(source, 'DB_NAME'),
    admin: {
      user: required(source, 'POSTGRES_USER'),
      password: required(source, 'POSTGRES_PASSWORD'),
    },
    passwords,
  };
}

export function connectionUrl(input: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}): string {
  const url = new URL('postgres://placeholder');
  url.hostname = input.host;
  url.port = String(input.port);
  url.pathname = `/${input.database}`;
  url.username = input.user;
  url.password = input.password;
  return url.toString();
}

export function roleUrl(config: DbConfig, key: DbRoleKey): string {
  return connectionUrl({
    host: config.host,
    port: config.port,
    database: config.database,
    user: DB_ROLES[key],
    password: config.passwords[key],
  });
}

/** O banco de manutenção sempre existe, mesmo antes de o banco do app ser criado. */
export function adminUrl(config: DbConfig): string {
  return connectionUrl({
    host: config.host,
    port: config.port,
    database: 'postgres',
    user: config.admin.user,
    password: config.admin.password,
  });
}
