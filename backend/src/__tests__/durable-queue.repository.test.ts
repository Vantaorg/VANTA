import { DurableQueueRepository, DurableQueueClient, DurableJob } from '../services/durable-queue.repository';

describe('DurableQueueRepository', () => {
  let db: jest.Mocked<DurableQueueClient>;
  let repo: DurableQueueRepository;

  beforeEach(() => {
    db = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };
    repo = new DurableQueueRepository(db);
  });

  it('persists enqueue values with parameterized SQL', async () => {
    const scheduled = new Date('2026-11-21T12:00:00Z');
    const id = await repo.enqueue('email:send', { to: 'user@example.test' }, {
      id: 'test-job', priority: 5, maxAttempts: 4, runAt: scheduled,
    });
    expect(id).toBe('test-job');
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "QueueJob"'), 'test-job',
      'email:send', JSON.stringify({ to: 'user@example.test' }), 5, 4, scheduled,
    );
  });

  it('rejects an empty job type', async () => {
    await expect(repo.enqueue('  ', {})).rejects.toThrow('Job type is required');
    expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('claims one due job and returns null when no job is available', async () => {
    const job = { id: 'j1' } as DurableJob;
    db.$queryRawUnsafe.mockResolvedValueOnce([job]);
    await expect(repo.claim('worker-a', 5000)).resolves.toBe(job);
    expect(db.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE SKIP LOCKED'), 'worker-a', 5000,
    );
    db.$queryRawUnsafe.mockResolvedValueOnce([]);
    await expect(repo.claim('worker-a')).resolves.toBeNull();
  });

  it('rejects blank worker identifiers', async () => {
    await expect(repo.claim('')).rejects.toThrow('Worker id is required');
    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('only completes a job owned by the worker', async () => {
    await expect(repo.complete('j1', 'worker-a')).resolves.toBe(true);
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('WHERE "id" = $1'), 'j1', 'worker-a',
    );
    db.$executeRawUnsafe.mockResolvedValueOnce(0);
    await expect(repo.complete('j1', 'worker-b')).resolves.toBe(false);
  });

  it('persists failure and retry timing for worker-owned jobs', async () => {
    await expect(repo.fail('j1', 'worker-a', new Error('boom'), 2500)).resolves.toBe(true);
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('CASE WHEN "attempts" >= "maxAttempts"'), 'j1', 'worker-a', 2500, 'boom',
    );
    db.$executeRawUnsafe.mockResolvedValueOnce(0);
    await expect(repo.fail('j1', 'worker-b', 'error')).resolves.toBe(false);
  });

  it('normalizes negative retry delay to zero', async () => {
    await repo.fail('j2', 'worker-a', 'failed', -20);
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.any(String), 'j2', 'worker-a', 0, 'failed',
    );
  });
});
