import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { loadDbConfig, roleUrl } from './config.js';
import { generateDictionary } from './dictionary-lib.js';

export const DICTIONARY_PATH = fileURLToPath(
  new URL('../../../docs/DATA_DICTIONARY.md', import.meta.url),
);

async function main(): Promise<void> {
  const client = new Client({ connectionString: roleUrl(loadDbConfig(), 'migrator') });
  await client.connect();
  try {
    writeFileSync(DICTIONARY_PATH, await generateDictionary(client));
    console.log('Dicionário de dados atualizado.');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha ao gerar o dicionário.');
  process.exitCode = 1;
});
