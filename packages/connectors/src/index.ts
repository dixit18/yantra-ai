// P1-REPO-001 seed for P8-SDK-043 — idempotency-key validation.
// Every connector write requires a UUID key (master spec §13.6); full SDK later.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidIdempotencyKey(key: string): boolean {
  return UUID_RE.test(key.trim());
}
