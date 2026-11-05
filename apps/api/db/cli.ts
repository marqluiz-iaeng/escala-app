import { bootstrapDatabase } from './bootstrap-lib.js';
import { adminUrl, loadDbConfig, roleUrl } from './config.js';
import { migrate } from './migrate-lib.js';

/** Uso: tsx db/cli.ts bootstrap | up | down [quantidade] */
async function main(): Promise<void> {
  const [command, argument] = process.argv.slice(2);
  const config = loadDbConfig();

  if (process.env.NODE_ENV === 'production' && command === 'down') {
    throw new Error('Descer migrações em produção exige um procedimento próprio.');
  }

  switch (command) {
    case 'bootstrap':
      await bootstrapDatabase({
        adminUrl: adminUrl(config),
        database: config.database,
        passwords: config.passwords,
      });
      console.log('Papéis e banco preparados.');
      return;
    case 'up':
      await migrate({ databaseUrl: roleUrl(config, 'migrator'), direction: 'up' });
      return;
    case 'down':
      await migrate({
        databaseUrl: roleUrl(config, 'migrator'),
        direction: 'down',
        count: argument ? Number(argument) : 1,
      });
      return;
    default:
      throw new Error('Comando desconhecido. Use bootstrap, up ou down.');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha na operação.');
  process.exitCode = 1;
});
