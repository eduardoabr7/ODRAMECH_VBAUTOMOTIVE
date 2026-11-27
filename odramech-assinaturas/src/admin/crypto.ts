import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
// custo alto de propósito: o painel tem pouquíssimos logins, e senha vazada fica cara de quebrar
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** "salt:hash" em hex */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64, SCRYPT);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length, SCRYPT);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** hash usado para conferir senha quando o e-mail não existe (mesmo tempo de resposta) */
export const DUMMY_HASH = '00000000000000000000000000000000:' + '0'.repeat(128);

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** no banco fica só o hash do token: vazar a tabela não entrega sessões válidas */
export function sessionId(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ─── TOTP (RFC 6238) — compatível com Google Authenticator, Authy, 1Password… ───
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function newTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (const c of clean) {
    const v = B32.indexOf(c);
    if (v < 0) throw new Error('segredo TOTP inválido');
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totpAt(secret: string, timeMs: number, step = 30): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timeMs / 1000 / step)));
  const h = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = h[h.length - 1] & 0xf;
  const code = ((h.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString();
  return code.padStart(6, '0');
}

/** aceita o código atual e o vizinho (±30 s) para tolerar relógio levemente fora */
export function verifyTotp(secret: string, code: string, nowMs = Date.now()): boolean {
  const clean = String(code ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  return [-1, 0, 1].some(w => {
    const expected = Buffer.from(totpAt(secret, nowMs + w * 30_000));
    const given = Buffer.from(clean);
    return timingSafeEqual(expected, given);
  });
}

export function totpUri(secret: string, email: string): string {
  return `otpauth://totp/${encodeURIComponent(`Odramech Admin:${email}`)}?secret=${secret}&issuer=${encodeURIComponent('Odramech Admin')}&digits=6&period=30`;
}
