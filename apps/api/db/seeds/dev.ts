import { FieldVault, LocalKeyProvider } from '../../src/crypto/vault.js';
import { loadDbConfig, roleUrl } from '../config.js';
import { seedDev } from './seed-lib.js';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('O seed de demonstração não roda em produção.');
  }
  const config = loadDbConfig();
  const { created } = await seedDev({
    migratorUrl: roleUrl(config, 'migrator'),
    appUrl: roleUrl(config, 'app'),
    vault: new FieldVault(new LocalKeyProvider()),
  });
  console.log(created ? 'Dados de demonstração criados.' : 'Os dados de demonstração já existem.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha no seed.');
  process.exitCode = 1;
});
