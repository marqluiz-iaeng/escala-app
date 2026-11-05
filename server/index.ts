import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { purgeExpired } from './routes/privacy.ts';
import { seedDemo } from './seed.ts';

const config = loadConfig();
const { app, ctx } = createApp(config);

if (config.demoMode && config.demoPassword) await seedDemo(ctx, config.demoPassword);

purgeExpired(ctx);
setInterval(() => purgeExpired(ctx), 15 * 60 * 1000).unref();

app.listen(config.port, config.host, () => {
  console.log(`Escala rodando em http://${config.host === '127.0.0.1' ? 'localhost' : config.host}:${config.port}`);
  if (config.demoMode) console.log('Modo demonstração ativo: dados fictícios. Use os botões de demonstração na tela inicial.');
});
