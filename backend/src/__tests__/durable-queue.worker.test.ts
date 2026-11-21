import { DurableJob, DurableQueueRepository } from '../services/durable-queue.repository';
import { DurableQueueWorker } from '../services/durable-queue.worker';

const job = (overrides: Partial<DurableJob> = {}): DurableJob => ({
  id: 'job-1', type: 'test:run', payload: {}, priority: 0, status: 'active',
  attempts: 1, maxAttempts: 3, runAt: new Date(), lockedAt: new Date(),
  lockedUntil: new Date(Date.now() + 60_000), workerId: 'worker-test',
  lastError: null, createdAt: new Date(), updatedAt: new Date(), completedAt: null,
  ...overrides,
});

describe('DurableQueueWorker', () => {
  const createRepository = () => ({
    claim: jest.fn<Promise<DurableJob | null>, [string, number]>()
      .mockResolvedValueOnce(job()).mockResolvedValue(null),
    renewLease: jest.fn<Promise<boolean>, [string, string, number]>().mockResolvedValue(true),
    complete: jest.fn<Promise<boolean>, [string, string]>().mockResolvedValue(true),
    fail: jest.fn<Promise<boolean>, [string, string, unknown, number]>().mockResolvedValue(true),
    failPermanently: jest.fn<Promise<boolean>, [string, string, unknown]>().mockResolvedValue(true),
  });

  it('processes and completes a claimed job, then stops polling', async () => {
    const repository = createRepository();
    const handler = jest.fn().mockResolvedValue(undefined);
    const worker = new DurableQueueWorker(repository as unknown as DurableQueueRepository, new Map([['test:run', handler]]), {
      workerId: 'worker-test', pollIntervalMs: 5,
    });
    worker.start();
    await new Promise(resolve => setTimeout(resolve, 10));
    await worker.stop();

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1' }));
    expect(repository.complete).toHaveBeenCalledWith('job-1', 'worker-test');
  });

  it('persists handler failures with bounded exponential retry delay', async () => {
    const repository = createRepository();
    const handler = jest.fn().mockRejectedValue(new Error('temporary'));
    const worker = new DurableQueueWorker(repository as unknown as DurableQueueRepository, new Map([['test:run', handler]]), {
      workerId: 'worker-test', pollIntervalMs: 5, retryBaseMs: 1_000, retryMaxMs: 5_000,
    });
    worker.start();
    await new Promise(resolve => setTimeout(resolve, 10));
    await worker.stop();

    expect(repository.fail).toHaveBeenCalledWith('job-1', 'worker-test', expect.any(Error), expect.any(Number));
    const retryDelay = repository.fail.mock.calls[0][3];
    expect(retryDelay).toBeGreaterThanOrEqual(800);
    expect(retryDelay).toBeLessThanOrEqual(1_200);
  });

  it('fails an unregistered job type instead of silently dropping it', async () => {
    const repository = createRepository();
    const worker = new DurableQueueWorker(repository as unknown as DurableQueueRepository, new Map(), {
      workerId: 'worker-test', pollIntervalMs: 5,
    });
    worker.start();
    await new Promise(resolve => setTimeout(resolve, 10));
    await worker.stop();

    expect(repository.failPermanently).toHaveBeenCalledWith('job-1', 'worker-test', expect.objectContaining({
      message: 'No durable handler registered for job type: test:run',
    }));
    expect(repository.complete).not.toHaveBeenCalled();
  });

  it('rejects unsafe worker configuration', () => {
    const repository = createRepository() as unknown as DurableQueueRepository;
    expect(() => new DurableQueueWorker(repository, new Map(), { concurrency: 0 })).toThrow('concurrency must be a positive integer');
    expect(() => new DurableQueueWorker(repository, new Map(), { leaseMs: 1_000 })).toThrow('leaseMs must be at least 3000ms');
  });
});
