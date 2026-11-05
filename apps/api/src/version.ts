import { readFileSync } from 'node:fs';

// Este arquivo fica na raiz de src/ e de dist/, então o caminho vale nos dois casos.
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export const APP_VERSION = manifest.version;
