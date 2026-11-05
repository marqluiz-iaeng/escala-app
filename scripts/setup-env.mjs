import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('../.env', import.meta.url));
const example = fileURLToPath(new URL('../.env.example', import.meta.url));

if (existsSync(target)) {
  console.log('.env já existe. Nada foi alterado.');
} else {
  const content = readFileSync(example, 'utf8').replaceAll('__RANDOM__', () =>
    randomBytes(24).toString('hex'),
  );
  writeFileSync(target, content, { mode: 0o600 });
  console.log('.env criado com segredos aleatórios.');
}
