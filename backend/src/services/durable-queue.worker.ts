import { randomUUID } from 'crypto';
import { DurableJob, DurableQueueRepository } from './durable-queue.repository';

export type DurableJobHandler = (job: DurableJob) => Promise<void>;

export interface DurableWorkerOptions {
  workerId?: string;
  concurrency?: number;
  leaseMs?: number;
  pollIntervalMs?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Explicitly-started PostgreSQL worker. It has no import-time side effects:
 * callers must opt in by constructing and starting it after database startup.
 */
export class DurableQueueWorker {
  private readonly workerId: string;
  private readonly concurrency: number;
  private readonly leaseMs: number;
  private readonly pollIntervalMs: number;
  private readonly retryBaseMs: number;
  private readonly retryMaxMs: number;
  private stopping = false;
  private started = false;
  private loops: Promise<void>[] = [];

  constructor(
    private readonly repository: DurableQueueRepository,
    private readonly handlers: ReadonlyMap<string, DurableJobHandler>,
    options: DurableWorkerOptions = {},
  ) {
    this.workerId = options.workerId ?? `vanta-worker-${randomUUID()}`;
    this.concurrency = options.concurrency ?? 2;
    this.leaseMs = options.leaseMs ?? 60_000;
    this.pollIntervalMs = options.pollIntervalMs ?? 1_000;
    this.retryBaseMs = options.retryBaseMs ?? 1_000;
    this.retryMaxMs = options.retryMaxMs ?? 30_000;

    if (!this.workerId.trim()) throw new Error('workerId is required');
    if (!Number.isInteger(this.concurrency) || this.concurrency < 1) throw new Error('concurrency must be a positive integer');
    if (!Number.isFinite(this.leaseMs) || this.leaseMs < 3_000) throw new Error('leaseMs must be at least 3000ms');
    if (!Number.isFinite(this.pollIntervalMs) || this.pollIntervalMs < 1) throw new Error('pollIntervalMs must be positive');
    if (!Number.isFinite(this.retryBaseMs) || this.retryBaseMs < 0) throw new Error('retryBaseMs must be non-negative');
    if (!Number.isFinite(this.retryMaxMs) || this.retryMaxMs < this.retryBaseMs) throw new Error('retryMaxMs must be >= retryBaseMs');
  }

  get id(): string { return this.workerId; }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.stopping = false;
    this.loops = Array.from({ length: this.concurrency }, () => this.poll());
  }

  /** Stop claiming new work and wait for already-claimed handlers to settle. */
  async stop(): Promise<void> {
    if (!this.started) return;
    this.stopping = true;
    await Promise.all(this.loops);
    this.loops = [];
    this.started = false;
  }

  private async poll(): Promise<void> {
    while (!this.stopping) {
      let job: DurableJob | null = null;
      try {
        job = await this.repository.claim(this.workerId, this.leaseMs);
      } catch (error) {
        console.error('[DurableQueueWorker] Claim failed:', error);
      }

      if (this.stopping) break;
      if (!job) {
        await sleep(this.pollIntervalMs);
        continue;
      }
      await this.process(job);
    }
  }

  private async process(job: DurableJob): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      await this.repository.fail(job.id, this.workerId, new Error(`No durable handler registered for job type: ${job.type}`), 0);
      return;
    }

    let leaseLost = false;
    let heartbeatStopped = false;
    let heartbeatRunning = false;
    const heartbeat = async (): Promise<void> => {
      if (heartbeatStopped || heartbeatRunning || leaseLost) return;
      heartbeatRunning = true;
      try {
        const renewed = await this.repository.renewLease(job.id, this.workerId, this.leaseMs);
        if (!renewed) leaseLost = true;
      } catch (error) {
        console.error(`[DurableQueueWorker] Lease renewal failed for ${job.id}:`, error);
        leaseLost = true;
      } finally {
        heartbeatRunning = false;
      }
    };
    const heartbeatTimer = setInterval(() => { void heartbeat(); }, Math.max(1_000, Math.floor(this.leaseMs / 3)));

    try {
      await handler(job);
      if (!leaseLost) {
        const completed = await this.repository.complete(job.id, this.workerId);
        if (!completed) console.warn(`[DurableQueueWorker] Lost ownership before completing ${job.id}`);
      }
    } catch (error) {
      if (!leaseLost) {
        const exponent = Math.max(0, job.attempts - 1);
        const delay = Math.min(this.retryBaseMs * (2 ** exponent), this.retryMaxMs);
        const jitteredDelay = Math.round(delay * (0.8 + Math.random() * 0.4));
        const failed = await this.repository.fail(job.id, this.workerId, error, jitteredDelay);
        if (!failed) console.warn(`[DurableQueueWorker] Lost ownership before recording failure for ${job.id}`);
      }
      console.error(`[DurableQueueWorker] Handler failed for ${job.id}:`, error);
    } finally {
      heartbeatStopped = true;
      clearInterval(heartbeatTimer);
    }
  }
}
