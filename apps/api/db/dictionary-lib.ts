import type { ClientBase } from 'pg';

type TableRow = { name: string; comment: string | null; rls: boolean };
type ColumnRow = {
  table_name: string;
  name: string;
  type: string;
  nullable: boolean;
  has_default: boolean;
  comment: string | null;
};
type TypeRow = { name: string; labels: string[] };

const cell = (value: string) => value.replaceAll('|', '\\|').replaceAll('\n', ' ');

function classify(column: string, comment: string | null): string {
  if (column.endsWith('_enc')) return 'Pessoal, cifrado';
  if (column.endsWith('_index')) return 'Índice cego';
  if (/location/.test(column))
    return /aproximada|público/i.test(comment ?? '') ? 'Aproximado' : 'Localização';
  if (/_hash$|sha256/.test(column)) return 'Hash';
  return '';
}

/** Gera o dicionário a partir do próprio banco: o que está aqui é o que existe de verdade. */
export async function generateDictionary(client: ClientBase): Promise<string> {
  const tables = await client.query<TableRow>(`
    SELECT c.relname AS name, obj_description(c.oid) AS comment, c.relforcerowsecurity AS rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'pgmigrations'
    ORDER BY c.relname`);
  const columns = await client.query<ColumnRow>(`
    SELECT c.relname AS table_name, a.attname AS name,
      format_type(a.atttypid, a.atttypmod) AS type,
      NOT a.attnotnull AS nullable,
      a.atthasdef AS has_default,
      col_description(c.oid, a.attnum) AS comment
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'pgmigrations'
      AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum`);
  const types = await client.query<TypeRow>(`
    SELECT t.typname AS name,
      array(SELECT e.enumlabel::text FROM pg_enum e WHERE e.enumtypid = t.oid ORDER BY e.enumsortorder) AS labels
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
    ORDER BY t.typname`);
  const views = await client.query<{ name: string; comment: string | null }>(`
    SELECT c.relname AS name, obj_description(c.oid) AS comment
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'analytics' AND c.relkind = 'v' ORDER BY c.relname`);

  const lines: string[] = [
    '# Dicionário de dados',
    '',
    '> Gerado a partir do banco por `pnpm --filter @escala/api db:dictionary`. Não edite à mão. Um teste falha se este arquivo ficar desatualizado.',
    '',
    `São ${tables.rows.length} tabelas. Todas têm \`FORCE ROW LEVEL SECURITY\`. Colunas \`_enc\` guardam dados cifrados na aplicação, e colunas \`_index\` guardam um HMAC para busca exata ([ADR-0006](adr/0006-criptografia-por-campo.md)).`,
    '',
    '## Tabelas',
    '',
  ];

  for (const table of tables.rows) {
    lines.push(`### ${table.name}`, '', table.comment ?? '', '');
    lines.push(
      '| Coluna | Tipo | Obrigatória | Sensibilidade | Descrição |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const column of columns.rows.filter((item) => item.table_name === table.name)) {
      const required = column.nullable ? 'Não' : column.has_default ? 'Sim, com padrão' : 'Sim';
      lines.push(
        `| \`${column.name}\` | \`${cell(column.type)}\` | ${required} | ${classify(column.name, column.comment)} | ${cell(column.comment ?? '')} |`,
      );
    }
    lines.push('');
  }

  lines.push(
    '## Visões de análise',
    '',
    'O papel `escala_analytics` só enxerga estas visões, sem dados de pessoas.',
    '',
  );
  for (const view of views.rows) lines.push(`- \`analytics.${view.name}\`: ${view.comment ?? ''}`);

  lines.push('', '## Tipos enumerados', '', '| Tipo | Valores |', '| --- | --- |');
  for (const type of types.rows) lines.push(`| \`${type.name}\` | ${type.labels.join(', ')} |`);

  return `${lines.join('\n')}\n`;
}
