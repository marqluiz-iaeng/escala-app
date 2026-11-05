import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const KEY_BYTES = 32;
const KEY_ID = /^[a-z0-9-]{1,32}$/;

/**
 * De onde vêm as chaves. Em produção, a implementação abre as chaves de dados com o KMS
 * ao subir (ADR-0006). O resto do código só conhece esta interface.
 */
export interface KeyProvider {
  readonly activeKeyId: string;
  /** Chave de dados pelo ID. Chaves antigas continuam disponíveis para leitura. */
  dataKey(keyId: string): Buffer | undefined;
  /** Chave separada dos índices cegos: a troca da chave de dados não pode invalidar as buscas. */
  blindIndexKey(): Buffer;
}

export class FieldVault {
  constructor(private readonly keys: KeyProvider) {}

  /**
   * AES-256-GCM. O `context` amarra o texto cifrado ao campo: o valor copiado para outra
   * coluna não abre. Formato: v1.<id da chave>.<iv>.<tag>.<texto cifrado>.
   */
  encrypt(plaintext: string, context: string): string {
    const keyId = this.keys.activeKeyId;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.requireKey(keyId), iv);
    cipher.setAAD(Buffer.from(context));
    const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [
      VERSION,
      keyId,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      body.toString('base64url'),
    ].join('.');
  }

  decrypt(token: string, context: string): string {
    const [version, keyId, iv, tag, body, ...rest] = token.split('.');
    if (version !== VERSION || !keyId || !iv || !tag || body === undefined || rest.length > 0) {
      throw new Error('Formato de cifra inválido.');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.requireKey(keyId),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(body, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  /** Índice cego: permite busca exata e unicidade sem guardar o valor em claro. */
  blindIndex(value: string, context: string): string {
    return createHmac('sha256', this.keys.blindIndexKey())
      .update(`${context}:${value}`)
      .digest('hex');
  }

  private requireKey(keyId: string): Buffer {
    const key = this.keys.dataKey(keyId);
    if (!key) throw new Error('Chave de criptografia indisponível.');
    return key;
  }
}

function decodeKey(encoded: string, name: string): Buffer {
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== KEY_BYTES) throw new Error(`${name} precisa ter ${KEY_BYTES} bytes.`);
  return key;
}

/**
 * Chaves vindas de variáveis de ambiente. Só para desenvolvimento e testes.
 * FIELD_ENCRYPTION_KEYS: "id:base64,id:base64". A primeira é a ativa, as demais só leem.
 */
export class LocalKeyProvider implements KeyProvider {
  readonly activeKeyId: string;
  private readonly dataKeys = new Map<string, Buffer>();
  private readonly indexKey: Buffer;

  constructor(source: NodeJS.ProcessEnv = process.env) {
    if (source.NODE_ENV === 'production') {
      throw new Error('Em produção, as chaves vêm do KMS.');
    }
    const entries = (source.FIELD_ENCRYPTION_KEYS ?? '').split(',').filter(Boolean);
    if (entries.length === 0) throw new Error('Falta a variável FIELD_ENCRYPTION_KEYS.');
    for (const entry of entries) {
      const separator = entry.indexOf(':');
      const keyId = entry.slice(0, separator);
      if (separator < 0 || !KEY_ID.test(keyId)) {
        throw new Error('FIELD_ENCRYPTION_KEYS precisa estar no formato id:base64.');
      }
      this.dataKeys.set(keyId, decodeKey(entry.slice(separator + 1), 'FIELD_ENCRYPTION_KEYS'));
    }
    this.activeKeyId = [...this.dataKeys.keys()][0] as string;
    if (!source.BLIND_INDEX_KEY) throw new Error('Falta a variável BLIND_INDEX_KEY.');
    this.indexKey = decodeKey(source.BLIND_INDEX_KEY, 'BLIND_INDEX_KEY');
  }

  dataKey(keyId: string): Buffer | undefined {
    return this.dataKeys.get(keyId);
  }

  blindIndexKey(): Buffer {
    return this.indexKey;
  }
}

/** A mesma pessoa precisa gerar o mesmo índice, com qualquer capitalização. */
export function normalizeEmail(email: string): string {
  return email.normalize('NFKC').trim().toLowerCase();
}

/** CPF e CNPJ chegam com ou sem pontuação. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}
