import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface Bucket { failures: number[]; lockedUntil: number }

const WINDOW_MS = 15 * 60_000;
/** erros de senha seguidos para o mesmo e-mail (vindo do mesmo IP) antes de travar */
const MAX_PER_ACCOUNT = 5;
/** erros vindos de um IP, somando todos os e-mails (tentativa de "varrer" contas) */
const MAX_PER_IP = 30;
const LOCK_MS = 15 * 60_000;

/**
 * Limite de tentativas de login (força bruta com Burp Intruder, hydra etc.).
 * Em memória: suficiente para uma instância; com várias instâncias, trocar por Redis.
 */
@Injectable()
export class LoginAttemptsService {
  private readonly buckets = new Map<string, Bucket>();

  private keys(email: string, ip: string) {
    return [`acc:${email.trim().toLowerCase()}|${ip}`, `ip:${ip}`];
  }

  private bucket(key: string): Bucket {
    let b = this.buckets.get(key);
    if (!b) { b = { failures: [], lockedUntil: 0 }; this.buckets.set(key, b); }
    const now = Date.now();
    b.failures = b.failures.filter(t => now - t < WINDOW_MS);
    return b;
  }

  /** chamado ANTES de conferir a senha */
  assertAllowed(email: string, ip: string): void {
    const now = Date.now();
    for (const key of this.keys(email, ip)) {
      const b = this.bucket(key);
      if (b.lockedUntil > now) {
        const min = Math.ceil((b.lockedUntil - now) / 60_000);
        throw new HttpException(
          { statusCode: 429, message: `Muitas tentativas de login. Tente de novo em ${min} minuto(s).` },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  fail(email: string, ip: string): void {
    const now = Date.now();
    const [acc, ipKey] = this.keys(email, ip);
    for (const [key, max] of [[acc, MAX_PER_ACCOUNT], [ipKey, MAX_PER_IP]] as const) {
      const b = this.bucket(key);
      b.failures.push(now);
      if (b.failures.length >= max) { b.lockedUntil = now + LOCK_MS; b.failures = []; }
    }
    if (this.buckets.size > 50_000) this.prune();
  }

  /** login certo: zera o contador da conta (o do IP continua) */
  success(email: string, ip: string): void {
    this.buckets.delete(this.keys(email, ip)[0]);
  }

  private prune() {
    const now = Date.now();
    for (const [k, b] of this.buckets) if (b.lockedUntil < now && !b.failures.some(t => now - t < WINDOW_MS)) this.buckets.delete(k);
  }
}
