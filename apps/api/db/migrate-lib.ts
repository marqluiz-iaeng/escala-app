import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';

export const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations', import.meta.url));

export type MigrateOptions = {
  databaseUrl: string;
  direction: 'up' | 'down';
  /** Quantas migrações aplicar. Sem valor: todas para subir, uma para descer. */
  count?: number;
  silent?: boolean;
};

export async function migrate(options: MigrateOptions): Promise<string[]> {
  const applied = await runner({
    databaseUrl: options.databaseUrl,
    dir: MIGRATIONS_DIR,
    migrationsTable: 'pgmigrations',
    direction: options.direction,
    count: options.count ?? (options.direction === 'up' ? Infinity : 1),
    // Cada migração roda em sua própria transação: uma falha não deixa nada pela metade.
    singleTransaction: false,
    checkOrder: true,
    log: options.silent ? () => undefined : undefined,
  });
  return applied.map((migration) => migration.name);
}
