import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Gera os tipos do Drizzle a partir do banco já migrado. O esquema nasce nas migrações (ADR-0004).
const OUT = fileURLToPath(new URL('../src/db/generated/', import.meta.url));

const COLUMN_TYPES: Record<string, string> = {
  geography: 'geography',
  money_cents: 'moneyCents',
  currency_code: 'currencyCode',
  tsvector: 'tsvector',
};

export function fixGeneratedSchema(source: string): string {
  const used = new Set<string>();
  const fixed = source.replace(
    /\/\/ TODO: failed to parse database type '(\w+)'\n(\s*\w+: )unknown\(/g,
    (_match, type: string, prefix: string) => {
      const name = COLUMN_TYPES[type];
      if (!name) throw new Error(`Tipo de coluna sem mapeamento: ${type}`);
      used.add(name);
      return `${prefix.trimStart()}${name}(`;
    },
  );
  if (fixed.includes('unknown(')) throw new Error('Ainda há colunas sem tipo no esquema gerado.');
  // O drizzle-kit escreve o padrão de texto vazio como `.default(')`, o que nem compila.
  const withDefaults = fixed.replaceAll(".default(')", ".default('')");
  const imports = `import { ${[...used].sort().join(', ')} } from '../column-types.js';\n`;
  return `// Gerado por \`pnpm --filter @escala/api db:pull\`. Não edite à mão.\n${imports}${withDefaults}`;
}

function main(): void {
  execFileSync('./node_modules/.bin/drizzle-kit', ['pull', '--config', 'drizzle.config.ts'], {
    stdio: 'inherit',
  });

  // O SQL gerado e os metadados não são usados: quem manda são as nossas migrações.
  rmSync(new URL('meta', `file://${OUT}`), { recursive: true, force: true });
  for (const file of readdirSync(OUT)) {
    if (file.endsWith('.sql')) rmSync(`${OUT}${file}`);
  }

  writeFileSync(`${OUT}schema.ts`, fixGeneratedSchema(readFileSync(`${OUT}schema.ts`, 'utf8')));
  const relations = readFileSync(`${OUT}relations.ts`, 'utf8').replaceAll(
    '"./schema"',
    '"./schema.js"',
  );
  writeFileSync(
    `${OUT}relations.ts`,
    `// Gerado por \`pnpm --filter @escala/api db:pull\`. Não edite à mão.\n${relations}`,
  );
  console.log('Tipos do banco atualizados.');
}

main();
