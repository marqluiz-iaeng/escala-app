import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { digitsOnly, FieldVault, LocalKeyProvider, normalizeEmail } from './vault.js';

const key = () => randomBytes(32).toString('base64');

function provider(keys = `k1:${key()}`, indexKey = key()) {
  return new LocalKeyProvider({
    NODE_ENV: 'test',
    FIELD_ENCRYPTION_KEYS: keys,
    BLIND_INDEX_KEY: indexKey,
  });
}

describe('FieldVault', () => {
  it('cifra e decifra, com acentos', () => {
    const vault = new FieldVault(provider());
    const token = vault.encrypt('Rua das Palmeiras, 123, São Paulo', 'jobs.address');
    expect(vault.decrypt(token, 'jobs.address')).toBe('Rua das Palmeiras, 123, São Paulo');
  });

  it('não deixa o valor em claro no texto cifrado', () => {
    const vault = new FieldVault(provider());
    const token = vault.encrypt('ana@exemplo.com', 'users.email');
    expect(token).not.toContain('ana');
    expect(Buffer.from(token.split('.')[4] as string, 'base64url').toString()).not.toContain('ana');
  });

  it('gera textos diferentes para o mesmo valor', () => {
    const vault = new FieldVault(provider());
    expect(vault.encrypt('igual', 'campo')).not.toBe(vault.encrypt('igual', 'campo'));
  });

  it('segue o formato v1.<chave>.<iv>.<tag>.<texto>', () => {
    const parts = new FieldVault(provider()).encrypt('valor', 'campo').split('.');
    expect(parts).toHaveLength(5);
    expect(parts.slice(0, 2)).toEqual(['v1', 'k1']);
  });

  it('não abre um valor copiado para outro campo', () => {
    const vault = new FieldVault(provider());
    const token = vault.encrypt('123', 'users.cpf');
    expect(() => vault.decrypt(token, 'users.phone')).toThrow();
  });

  it.each([
    ['iv', 2],
    ['tag', 3],
    ['texto', 4],
  ])('recusa %s alterado', (_name, index) => {
    const vault = new FieldVault(provider());
    const parts = vault.encrypt('valor secreto', 'campo').split('.');
    const original = Buffer.from(parts[index] as string, 'base64url');
    original[0] = (original[0] as number) ^ 0xff;
    parts[index] = original.toString('base64url');
    expect(() => vault.decrypt(parts.join('.'), 'campo')).toThrow();
  });

  it.each(['', 'texto', 'v2.k1.a.b.c', 'v1.k1.a.b', 'v1.k1.a.b.c.d'])(
    'recusa o formato inválido "%s"',
    (token) => {
      expect(() => new FieldVault(provider()).decrypt(token, 'campo')).toThrow(
        'Formato de cifra inválido.',
      );
    },
  );

  it('não abre com outra chave de mesmo ID', () => {
    const token = new FieldVault(provider()).encrypt('valor', 'campo');
    expect(() => new FieldVault(provider()).decrypt(token, 'campo')).toThrow();
  });

  it('depois da rotação, cifra com a chave nova e ainda lê a antiga', () => {
    const oldKey = key();
    const before = new FieldVault(provider(`k1:${oldKey}`));
    const token = before.encrypt('valor', 'campo');

    const after = new FieldVault(provider(`k2:${key()},k1:${oldKey}`));
    expect(after.decrypt(token, 'campo')).toBe('valor');
    expect(after.encrypt('valor', 'campo').split('.')[1]).toBe('k2');
  });

  it('o erro de chave ausente não revela o conteúdo', () => {
    const token = new FieldVault(provider('k1:' + key())).encrypt('segredo', 'campo');
    const vault = new FieldVault(provider('k9:' + key()));
    expect(() => vault.decrypt(token, 'campo')).toThrow('Chave de criptografia indisponível.');
  });
});

describe('índice cego', () => {
  it('é estável para o mesmo valor e campo', () => {
    const vault = new FieldVault(provider());
    expect(vault.blindIndex('a@b.com', 'users.email')).toBe(
      vault.blindIndex('a@b.com', 'users.email'),
    );
  });

  it('muda com o campo, para não relacionar colunas', () => {
    const vault = new FieldVault(provider());
    expect(vault.blindIndex('123', 'users.cpf')).not.toBe(
      vault.blindIndex('123', 'companies.cnpj'),
    );
  });

  it('depende da chave: sem ela, não dá para testar valores conhecidos', () => {
    expect(new FieldVault(provider()).blindIndex('123', 'campo')).not.toBe(
      new FieldVault(provider()).blindIndex('123', 'campo'),
    );
  });

  it('continua igual depois da troca da chave de dados', () => {
    const indexKey = key();
    expect(new FieldVault(provider(`k1:${key()}`, indexKey)).blindIndex('a', 'c')).toBe(
      new FieldVault(provider(`k2:${key()}`, indexKey)).blindIndex('a', 'c'),
    );
  });

  it('não contém o valor', () => {
    expect(new FieldVault(provider()).blindIndex('ana@exemplo.com', 'campo')).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });
});

describe('LocalKeyProvider', () => {
  it('recusa rodar em produção', () => {
    expect(
      () =>
        new LocalKeyProvider({
          NODE_ENV: 'production',
          FIELD_ENCRYPTION_KEYS: `k1:${key()}`,
          BLIND_INDEX_KEY: key(),
        }),
    ).toThrow('Em produção, as chaves vêm do KMS.');
  });

  it.each([
    ['sem chaves', { NODE_ENV: 'test', BLIND_INDEX_KEY: 'x' }],
    ['chave curta', { NODE_ENV: 'test', FIELD_ENCRYPTION_KEYS: 'k1:YWJj', BLIND_INDEX_KEY: 'x' }],
    ['sem ID', { NODE_ENV: 'test', FIELD_ENCRYPTION_KEYS: 'YWJj', BLIND_INDEX_KEY: 'x' }],
    ['ID inválido', { NODE_ENV: 'test', FIELD_ENCRYPTION_KEYS: 'K.1:YWJj', BLIND_INDEX_KEY: 'x' }],
  ])('recusa configuração inválida: %s', (_name, env) => {
    expect(() => new LocalKeyProvider(env as NodeJS.ProcessEnv)).toThrow();
  });

  it('recusa índice cego ausente ou curto', () => {
    const base = { NODE_ENV: 'test', FIELD_ENCRYPTION_KEYS: `k1:${key()}` } as NodeJS.ProcessEnv;
    expect(() => new LocalKeyProvider(base)).toThrow('BLIND_INDEX_KEY');
    expect(() => new LocalKeyProvider({ ...base, BLIND_INDEX_KEY: 'YWJj' })).toThrow(
      'BLIND_INDEX_KEY',
    );
  });

  it('a mensagem de erro não mostra o valor da chave', () => {
    const shortKey = 'c2VncmVkbw==';
    try {
      new LocalKeyProvider({
        NODE_ENV: 'test',
        FIELD_ENCRYPTION_KEYS: `k1:${shortKey}`,
        BLIND_INDEX_KEY: key(),
      });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(shortKey);
    }
  });
});

describe('normalização', () => {
  it('normaliza e-mail', () => {
    expect(normalizeEmail('  Ana@Exemplo.COM ')).toBe('ana@exemplo.com');
  });

  it('deixa só os dígitos do CPF e do CNPJ', () => {
    expect(digitsOnly('123.456.789-01')).toBe('12345678901');
    expect(digitsOnly('12.345.678/0001-90')).toBe('12345678000190');
  });
});
