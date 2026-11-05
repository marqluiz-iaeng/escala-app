import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('../.env', import.meta.url));
const example = fileURLToPath(new URL('../.env.example', import.meta.url));

const withSecrets = (text) =>
  text
    .replaceAll('__RANDOM_KEY__', () => randomBytes(32).toString('base64'))
    .replaceAll('__RANDOM__', () => randomBytes(24).toString('hex'));

const keyOf = (line) => /^([A-Z0-9_]+)=/.exec(line)?.[1];
const template = readFileSync(example, 'utf8');

if (!existsSync(target)) {
  writeFileSync(target, withSecrets(template), { mode: 0o600 });
  console.log('.env criado com segredos aleatórios.');
} else {
  // Só acrescenta o que falta. Um valor existente nunca é trocado: trocar uma senha
  // ou chave deixaria o banco e os dados cifrados inacessíveis.
  const current = readFileSync(target, 'utf8');
  const present = new Set(current.split('\n').map(keyOf).filter(Boolean));
  const missing = template.split('\n').filter((line) => {
    const key = keyOf(line);
    return key && !present.has(key);
  });
  if (missing.length === 0) {
    console.log('.env já está completo. Nada foi alterado.');
  } else {
    const separator = current.endsWith('\n') ? '' : '\n';
    writeFileSync(target, `${current}${separator}${withSecrets(missing.join('\n'))}\n`, {
      mode: 0o600,
    });
    // Só os nomes: os valores são segredos.
    console.log(`.env atualizado: ${missing.map(keyOf).join(', ')}.`);
  }
}
