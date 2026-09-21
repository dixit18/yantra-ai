// P1-AUTH-004 — HMAC request tokens. Passwordless/B2B skeleton (master spec
// §14): the API trusts only tokens it signed with APP_SECRET — never headers,
// query params, or UI-supplied scope. Enterprise SSO arrives later; the
// RequestContext shape it must produce is already fixed (see permissions.ts).
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TokenPayload {
  tenantId: string;
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

export const DEFAULT_TOKEN_TTL_SECONDS = 12 * 60 * 60;
const MAX_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const MIN_SECRET_LENGTH = 32;

function base64urlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function base64urlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

export function issueToken(
  ids: { tenantId: string; userId: string },
  secret: string,
  issuedAt: number = Math.floor(Date.now() / 1000),
  ttlSeconds: number = DEFAULT_TOKEN_TTL_SECONDS,
): string {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error('token secret must be at least 32 characters');
  }
  if (!ids.tenantId.trim() || !ids.userId.trim()) {
    throw new Error('token ids must not be empty');
  }
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > MAX_TOKEN_TTL_SECONDS) {
    throw new Error(`token ttl must be between 1 and ${MAX_TOKEN_TTL_SECONDS} seconds`);
  }
  const payload: TokenPayload = {
    tenantId: ids.tenantId,
    userId: ids.userId,
    issuedAt,
    expiresAt: issuedAt + ttlSeconds,
  };
  const body = base64urlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `y1.${body}.${sig}`;
}

export function verifyToken(token: string, secret: string, now?: number): TokenPayload {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error('token secret must be at least 32 characters');
  }
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'y1' || !parts[1] || !parts[2]) {
    throw new Error('unauthenticated: malformed token');
  }
  const [, body, sig] = parts as [string, string, string];
  const expected = createHmac('sha256', secret).update(body).digest();
  let actual: Buffer;
  try {
    actual = base64urlDecode(sig);
  } catch {
    throw new Error('unauthenticated: malformed token signature');
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error('unauthenticated: bad token signature');
  }
  let payload: TokenPayload;
  try {
    payload = JSON.parse(base64urlDecode(body).toString('utf8')) as TokenPayload;
  } catch {
    throw new Error('unauthenticated: malformed token payload');
  }
  if (
    typeof payload.tenantId !== 'string' ||
    typeof payload.userId !== 'string' ||
    typeof payload.expiresAt !== 'number' ||
    !payload.tenantId ||
    !payload.userId
  ) {
    throw new Error('unauthenticated: malformed token payload');
  }
  const at = now ?? Math.floor(Date.now() / 1000);
  if (payload.expiresAt <= at) {
    throw new Error('unauthenticated: token expired');
  }
  return payload;
}
