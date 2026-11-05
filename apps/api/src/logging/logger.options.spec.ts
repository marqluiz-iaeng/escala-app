import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { pathWithoutQuery, REDACT_PATHS } from './logger.options.js';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  return { logger: pino({ redact: { paths: REDACT_PATHS, censor: '[oculto]' } }, stream), lines };
}

describe('logs sem dados pessoais', () => {
  it('oculta campos sensíveis na raiz e em um nível de profundidade', () => {
    const { logger, lines } = capture();
    logger.info(
      { email: 'ana@example.com', user: { cpf: '12345678909', phone: '21999990000' } },
      'x',
    );
    const output = lines.join('');
    expect(output).not.toContain('ana@example.com');
    expect(output).not.toContain('12345678909');
    expect(output).not.toContain('21999990000');
    expect(output).toContain('[oculto]');
  });

  it('remove parâmetros de busca do caminho registrado', () => {
    expect(pathWithoutQuery('/v1/vagas?email=ana@example.com&token=abc')).toBe('/v1/vagas');
    expect(pathWithoutQuery(undefined)).toBe('');
  });
});
