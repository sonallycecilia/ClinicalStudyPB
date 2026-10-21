import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto';
import type { AccessTokenPayload } from './auth.types.js';
import type { PublicUser } from '../users/user.types.js';

function getSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_JWT_SECRET precisa estar configurado em produção.');
  }
  return secret ?? 'clinicalstudypb-development-only-secret';
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signature(input: string): string {
  return createHmac('sha256', getSecret()).update(input).digest('base64url');
}

export function createAccessToken(user: PublicUser, lifetimeSeconds = 60 * 60): string {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + lifetimeSeconds,
  };
  const content = `${header}.${encode(payload)}`;
  return `${content}.${signature(content)}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const pieces = token.split('.');
  if (pieces.length !== 3) return null;
  const [headerPart, payloadPart, suppliedSignature] = pieces;
  if (!headerPart || !payloadPart || !suppliedSignature) return null;

  try {
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8')) as { alg?: string };
    if (header.alg !== 'HS256') return null;
    const content = `${headerPart}.${payloadPart}`;
    const expected = Buffer.from(signature(content));
    const actual = Buffer.from(suppliedSignature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as AccessTokenPayload;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
