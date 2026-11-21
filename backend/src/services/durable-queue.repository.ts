export interface DurableQueueClient {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

export type DurableJobStatus = 'pending' | 'active' | 'completed' | 'failed';

export interface DurableJob {
  id: string;
  type: string;
  payload: unknown;
  priority: number;
  status: DurableJobStatus;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  lockedAt: Date | null;
  lockedUntil: Date | null;
  workerId: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface EnqueueOptions {
  id?: string;
  priority?: number;
  maxAttempts?: number;
  runAt?: Date;
}

export class DurableQueueRepository {
  constructor(private readonly db: DurableQueueClient) {}

  async enqueue(type: string, payload: unknown, options: EnqueueOptions = {}): Promise<string> {
    if (!type.trim()) throw new Error('Job type is required');
    const id = options.id ?? `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await this.db.$executeRawUnsafe(
      `INSERT INTO "QueueJob" ("id", "type", "payload", "priority", "maxAttempts", "runAt")
       VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
      id, type, JSON.stringify(payload ?? null), options.priority ?? 0,
      options.maxAttempts ?? 3, options.runAt ?? new Date(),
    );
    return id;
  }

  async claim(workerId: string, leaseMs = 60_000): Promise<DurableJob | null> {
    if (!workerId.trim()) throw new Error('Worker id is required');
    const rows = await this.db.$queryRawUnsafe<DurableJob[]>(
      `WITH candidate AS (
         SELECT "id" FROM "QueueJob"
         WHERE ("status" = 'pending' AND "runAt" <= NOW())
            OR ("status" = 'active' AND "lockedUntil" <= NOW())
         ORDER BY "priority" DESC, "runAt" ASC, "createdAt" ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE "QueueJob" AS job
       SET "status" = 'active', "workerId" = $1, "lockedAt" = NOW(),
           "lockedUntil" = NOW() + ($2 * INTERVAL '1 millisecond'),
           "attempts" = job."attempts" + 1, "updatedAt" = NOW()
       FROM candidate WHERE job."id" = candidate."id"
       RETURNING job.*`,
      workerId, leaseMs,
    );
    return rows[0] ?? null;
  }

  async complete(jobId: string, workerId: string): Promise<boolean> {
    const count = await this.db.$executeRawUnsafe(
      `UPDATE "QueueJob" SET "status" = 'completed', "completedAt" = NOW(),
       "lockedAt" = NULL, "lockedUntil" = NULL, "workerId" = NULL, "updatedAt" = NOW()
       WHERE "id" = $1 AND "status" = 'active' AND "workerId" = $2`,
      jobId, workerId,
    );
    return count === 1;
  }

  async fail(jobId: string, workerId: string, error: unknown, retryDelayMs = 1000): Promise<boolean> {
    const message = error instanceof Error ? error.message : String(error);
    const count = await this.db.$executeRawUnsafe(
      `UPDATE "QueueJob" SET
       "status" = CASE WHEN "attempts" >= "maxAttempts" THEN 'failed' ELSE 'pending' END,
       "runAt" = CASE WHEN "attempts" >= "maxAttempts" THEN "runAt"
                     ELSE NOW() + ($3 * INTERVAL '1 millisecond') END,
       "lastError" = $4, "lockedAt" = NULL, "lockedUntil" = NULL,
       "workerId" = NULL, "updatedAt" = NOW()
       WHERE "id" = $1 AND "status" = 'active' AND "workerId" = $2`,
      jobId, workerId, Math.max(0, retryDelayMs), message,
    );
    return count === 1;
  }
}
