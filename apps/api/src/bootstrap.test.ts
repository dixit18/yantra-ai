import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bootstrap } from './bootstrap.js';

const SECRET = 's3cr3t-no-log';

function testEnv(blobRoot: string) {
  return {
    DATABASE_URL: `postgresql://user:${SECRET}@localhost:5432/appdb`,
    APP_SECRET: 'local-dev-only-change-me',
    LOCAL_BLOB_ROOT: blobRoot,
  };
}

const healthyQuery = async (sql: string) => {
  if (sql.includes('version()')) {
    return { rows: [{ version: 'PostgreSQL 18.6 (test double)' }] };
  }
  return { rows: [{ extversion: '0.8.6' }] };
};

describe('bootstrap', () => {
  it('boots against injected seams and redacts the database identity', async () => {
    const blobRoot = await mkdtemp(join(tmpdir(), 'yantra-boot-'));
    const status = await bootstrap(testEnv(blobRoot), { query: healthyQuery });
    expect(status.env).toBe('valid');
    expect(status.model).toBe('mock');
    expect(status.database.reachable).toBe(true);
    expect(status.blobRoot).toBe(blobRoot);
    expect(status.databaseHost).toBe('postgresql://***@localhost:5432/appdb');
    expect(JSON.stringify(status)).not.toContain(SECRET);
  });

  it('reports live model mode when a key is configured', async () => {
    const blobRoot = await mkdtemp(join(tmpdir(), 'yantra-boot-'));
    const status = await bootstrap(
      { ...testEnv(blobRoot), MODEL_API_KEY: 'key', MODEL_PROVIDER: 'test' },
      { query: healthyQuery },
    );
    expect(status.model).toBe('live');
  });

  it('stays in mock mode when the key lacks a provider', async () => {
    const blobRoot = await mkdtemp(join(tmpdir(), 'yantra-boot-'));
    const status = await bootstrap(
      { ...testEnv(blobRoot), MODEL_API_KEY: 'key' },
      { query: healthyQuery },
    );
    expect(status.model).toBe('mock');
  });

  it('fails clearly when pgvector is missing', async () => {
    const blobRoot = await mkdtemp(join(tmpdir(), 'yantra-boot-'));
    const noVector = async (sql: string) =>
      sql.includes('version()') ? { rows: [{ version: 'PostgreSQL 18.6' }] } : { rows: [] };
    await expect(bootstrap(testEnv(blobRoot), { query: noVector })).rejects.toThrow(/pgvector/);
  });

  it('fails clearly on a bad environment', async () => {
    const blobRoot = await mkdtemp(join(tmpdir(), 'yantra-boot-'));
    await expect(bootstrap({ LOCAL_BLOB_ROOT: blobRoot }, { query: healthyQuery })).rejects.toThrow(
      /DATABASE_URL/,
    );
  });

  it('declares no scale-later dependencies (lean MVP rule)', async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const manifests = [
      resolve(here, '../package.json'),
      resolve(here, '../../../packages/contracts/package.json'),
      resolve(here, '../../../packages/config/package.json'),
      resolve(here, '../../../packages/db/package.json'),
    ];
    const banned = [
      'redis',
      'ioredis',
      'bullmq',
      '@aws-sdk/client-s3',
      '@temporalio/client',
      'kafkajs',
      'minio',
    ];
    for (const path of manifests) {
      const manifest = JSON.parse(await readFile(path, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const declared = [
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.devDependencies ?? {}),
      ];
      expect(
        declared.filter((d) => banned.includes(d)),
        path,
      ).toEqual([]);
    }
  });
});
