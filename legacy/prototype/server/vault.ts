import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from 'node:crypto';

export type Vault = {
  /** AES-256-GCM. `context` amarra o texto cifrado ao campo: não dá para copiá-lo para outra coluna. */
  encrypt(plain: string, context: string): string;
  decrypt(payload: string, context: string): string;
  maybeDecrypt(payload: string | null, context: string): string | null;
  /** HMAC determinístico: permite buscar por igualdade sem guardar o valor em claro. */
  index(value: string, context: string): string;
};

export function createVault(encKey: Buffer, hmacKey: Buffer): Vault {
  const vault: Vault = {
    encrypt(plain, context) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', encKey, iv);
      cipher.setAAD(Buffer.from(context));
      const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
    },
    decrypt(payload, context) {
      const [version, iv, tag, body] = payload.split('.');
      if (version !== 'v1' || !iv || !tag || body === undefined) throw new Error('Formato de cifra inválido.');
      const decipher = createDecipheriv('aes-256-gcm', encKey, Buffer.from(iv, 'base64url'));
      decipher.setAAD(Buffer.from(context));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
    },
    maybeDecrypt(payload, context) {
      return payload === null ? null : vault.decrypt(payload, context);
    },
    index(value, context) {
      return createHmac('sha256', hmacKey).update(`${context}:${value}`).digest('hex');
    },
  };
  return vault;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// Parâmetros recomendados pela OWASP para scrypt: N=2^17, r=8, p=1.
const SCRYPT = { N: 2 ** 17, r: 8, p: 1, keylen: 32, maxmem: 256 * 1024 * 1024 };

function derive(password: string, salt: Buffer, N: number, r: number, p: number, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password.normalize('NFKC'), salt, keylen, { N, r, p, maxmem: SCRYPT.maxmem }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p, SCRYPT.keylen);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !N || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await derive(password, Buffer.from(salt, 'base64url'), Number(N), Number(r), Number(p), expected.length);
  return timingSafeEqual(actual, expected);
}
