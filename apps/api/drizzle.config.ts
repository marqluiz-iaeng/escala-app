import { defineConfig } from 'drizzle-kit';
import { loadDbConfig, roleUrl } from './db/config.js';

// Só para gerar os tipos a partir do banco (`pnpm --filter @escala/api db:pull`).
// O esquema nasce nas migrações em SQL, nunca aqui (ADR-0004).
export default defineConfig({
  dialect: 'postgresql',
  out: './src/db/generated',
  schemaFilter: ['public'],
  tablesFilter: ['!pgmigrations'],
  extensionsFilters: ['postgis'],
  dbCredentials: { url: roleUrl(loadDbConfig(), 'migrator') },
});
