/**
 * Papéis de banco e a função de cada um (ADR-0005 e ADR-0011).
 * Nenhum papel de aplicação tem BYPASSRLS. Só o migrator, que nunca atende requisições.
 */
export const DB_ROLES = {
  migrator: 'escala_migrator',
  app: 'escala_app',
  auth: 'escala_auth',
  worker: 'escala_worker',
  support: 'escala_support',
  analytics: 'escala_analytics',
} as const;

export type DbRoleKey = keyof typeof DB_ROLES;

export const APPLICATION_ROLES: DbRoleKey[] = ['app', 'auth', 'worker', 'support', 'analytics'];

export const PASSWORD_ENV: Record<DbRoleKey, string> = {
  migrator: 'DB_MIGRATOR_PASSWORD',
  app: 'DB_APP_PASSWORD',
  auth: 'DB_AUTH_PASSWORD',
  worker: 'DB_WORKER_PASSWORD',
  support: 'DB_SUPPORT_PASSWORD',
  analytics: 'DB_ANALYTICS_PASSWORD',
};
