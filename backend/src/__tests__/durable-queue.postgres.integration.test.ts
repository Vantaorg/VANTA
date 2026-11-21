import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { DurableQueueRepository, DurableQueueClient } from '../services/durable-queue.repository';

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase('DurableQueueRepository PostgreSQL integration', () => {
  let admin: Pool;
  let pool: Pool;
  let repository: DurableQueueRepository;
  let schema: string;

  beforeAll(async () => {
    if (!databaseUrl) return;
    schema = `durable_queue_test_${randomUUID().replace(/-/g, '')}`;
    admin = new Pool({ connectionString: databaseUrl, max: 1 });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({ connectionString: databaseUrl, max: 8, options: `-c search_path=${schema}` });
    await pool.query(`
      CREATE TABLE "QueueJob" (
        "id" TEXT PRIMARY KEY, "type" TEXT NOT NULL, "payload" JSONB NOT NULL,
        "priority" INTEGER NOT NULL DEFAULT 0, "status" TEXT NOT NULL DEFAULT 'pending',
        "attempts" INTEGER NOT NULL DEFAULT 0, "maxAttempts" INTEGER NOT NULL DEFAULT 3,
        "runAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "lockedAt" TIMESTAMPTZ,
        "lockedUntil" TIMESTAMPTZ, "workerId" TEXT, "lastError" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "completedAt" TIMESTAMPTZ
      )
    `);
    const client: DurableQueueClient = {
      $executeRawUnsafe: async (query, ...values) => (await pool.query(query, values)).rowCount ?? 0,
      $queryRawUnsafe: async <T>(query: string, ...values: unknown[]) => (await pool.query(query, values)).rows as T,
    };
    repository = new DurableQueueRepository(client);
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (admin && schema) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  });

  beforeEach(async () => { if (pool) await pool.query('TRUNCATE TABLE "QueueJob"'); });

  it('allows only one worker to claim a single job under concurrent contention', async () => {
    await repository.enqueue('integration:once', { value: 42 }, { id: 'single-job' });
    const claims = await Promise.all([repository.claim('worker-a'), repository.claim('worker-b')]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(claims.find(Boolean)).toMatchObject({ id: 'single-job', status: 'active', attempts: 1 });
  });

  it('reclaims an expired lease and prevents the previous worker from completing it', async () => {
    await repository.enqueue('integration:lease', {}, { id: 'lease-job', maxAttempts: 2 });
    const first = await repository.claim('worker-a', 60_000);
    expect(first).not.toBeNull();
    await pool.query('UPDATE "QueueJob" SET "lockedUntil" = NOW() - INTERVAL \'1 second\' WHERE "id" = $1', ['lease-job']);
    const second = await repository.claim('worker-b', 60_000);
    expect(second).toMatchObject({ id: 'lease-job', workerId: 'worker-b', attempts: 2 });
    await expect(repository.complete('lease-job', 'worker-a')).resolves.toBe(false);
    await expect(repository.complete('lease-job', 'worker-b')).resolves.toBe(true);
  });

  it('moves a failed attempt to pending with persisted retry time, then marks exhausted jobs failed', async () => {
    await repository.enqueue('integration:retry', {}, { id: 'retry-job', maxAttempts: 1 });
    const claimed = await repository.claim('worker-a');
    expect(claimed).not.toBeNull();
    await expect(repository.fail('retry-job', 'worker-a', new Error('integration failure'), 0)).resolves.toBe(true);
    const row = await pool.query('SELECT "status", "lastError", "workerId" FROM "QueueJob" WHERE "id" = $1', ['retry-job']);
    expect(row.rows[0]).toMatchObject({ status: 'failed', lastError: 'integration failure', workerId: null });
    await expect(repository.claim('worker-b')).resolves.toBeNull();
  });
});
