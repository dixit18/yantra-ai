// P1-REPO-001 seed for P1-ENV-002 / P1-DB-003 — connection-string access
// (presence check only; the value itself is never logged).
export function readDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env['DATABASE_URL']?.trim();
  if (!url) {
    throw new Error('DATABASE_URL is not set (see .env.example)');
  }
  return url;
}

export function databaseScheme(url: string): string {
  const head = url.split(':', 1)[0];
  return head ?? '';
}
