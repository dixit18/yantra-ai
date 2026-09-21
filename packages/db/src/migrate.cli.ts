// `pnpm --filter @yantra/db migrate [-- --seed]` — applies pending migrations
// (and optionally the demo seed) to DATABASE_URL. Prints hosts, never secrets.
import { redactDatabaseUrl } from '@yantra/contracts';
import { Pool } from 'pg';
import { POSTGRES_POOL_OPTIONS, readDatabaseUrl } from './index.js';
import { defaultMigrationsDir, migrate } from './migrate.js';
import { seedDemoTenant } from './seed.js';

const url = readDatabaseUrl();
const pool = new Pool({ connectionString: url, ...POSTGRES_POOL_OPTIONS });
try {
  const applied = await migrate(() => pool.connect(), defaultMigrationsDir());
  console.log(`migrations applied: ${applied.length > 0 ? applied.join(', ') : '(none pending)'}`);
  if (process.argv.includes('--seed')) {
    const seed = await seedDemoTenant(async () => pool.connect());
    console.log(`demo tenant: ${seed.tenantId} (created: ${seed.created})`);
  }
  console.log(`database: ${redactDatabaseUrl(url)}`);
} finally {
  await pool.end();
}
