# Durable Queue Redesign — Phase 5

Status: Proposed (no runtime implementation)
Scope: Replace the process-local queue, delayed timers, and retry timers with restart-safe scheduling while preserving the existing job producer API.

## Current behavior verified in queue.service.ts
- Pending jobs are stored in a process-local array and persisted as a cache snapshot.
- Delayed jobs are represented by process-local timers and are not included in the pending snapshot until the timer fires.
- Failed-job retry is scheduled with an in-process setTimeout; the retry delay and attempt state are not durably scheduled.
- Active jobs are not durably claimed. A process restart cannot reliably distinguish an interrupted job from completed work.
- Cache persistence errors and restore errors are swallowed.
- Handler registry is process-local; jobs with no registered handler are marked failed.

## Goals
1. Persist each job and its status, schedule time, attempt count, error/result metadata, and timestamps.
2. Persist delayed and retry jobs at enqueue time; workers should poll/claim due jobs rather than depend on timers.
3. Claim jobs atomically across replicas using a PostgreSQL transaction/locking strategy (e.g. SELECT ... FOR UPDATE SKIP LOCKED).
4. Recover jobs left active after worker crash with a lease/locked-until field.
5. Preserve priority ordering and bounded concurrency.
6. Make retry/backoff deterministic from stored attempts and next-run timestamp; cap backoff and keep jitter optional.
7. Keep enqueue idempotency via optional idempotency/group key and a unique constraint.
8. Record terminal failures in a durable dead-letter state and provide a safe replay operation.
9. Report persistence failures instead of silently acknowledging a job that was not durably stored.
10. Avoid changing producer behavior until all existing producers and handler registrations are inventoried.

## Proposed Prisma/PostgreSQL model (schema-level proposal)
QueueJob fields:
- id (UUID primary key)
- type (string)
- payload (JSONB)
- priority (integer default 0)
- status (enum: pending, active, completed, failed, dead_letter)
- attempts (integer default 0)
- maxAttempts (integer)
- runAt (timestamp; due time for initial delay/retry)
- lockedAt / lockedUntil (nullable timestamps)
- workerId (nullable string)
- groupId / idempotencyKey (nullable)
- timeoutMs (nullable)
- tags (JSONB or text array)
- lastError (nullable text)
- result (nullable JSONB; subject to size limits)
- createdAt, updatedAt, startedAt, completedAt

Indexes:
- (status, runAt, priority DESC, createdAt) for due-job scans
- lockedUntil for lease recovery
- unique partial index for non-null idempotencyKey (if supported by migration strategy)
- group/type deduplication only if current semantics are explicitly preserved and reviewed

## Worker protocol
1. Transactionally select due pending jobs ordered by priority/runAt/createdAt, using SKIP LOCKED.
2. Set status=active, workerId, lockedAt, lockedUntil, startedAt and commit.
3. Run handler outside the transaction.
4. On success, update completed/result and clear lease fields.
5. On failure, increment attempts. If attempts remain, set pending and runAt to computed backoff; otherwise mark dead_letter. Clear lease fields in all cases.
6. On boot and periodically, reclaim active jobs whose lease expired, making them pending (or applying a documented attempt policy).
7. A heartbeat may extend leases for long jobs; only add it after timeout/worker lifecycle tests exist.

## Safety and migration
- Do not deploy or migrate production data in this phase.
- Do not delete the cache snapshot until rollback and data reconciliation are defined.
- During migration, either stop enqueueing briefly or use dual-write with reconciliation; dual-write is not automatically safe.
- Preserve the existing API initially, but introduce a storage/worker interface so the legacy implementation can be tested separately.
- Job handlers must be idempotent or protected by a job-specific idempotency mechanism. Queue delivery should be treated as at-least-once.
- Result/payload sizes need limits and sensitive data must not be stored in queue payloads.

## Implementation order
A. Add Prisma migration/model and unit tests for repository/claim/lease/retry behavior.
B. Implement Postgres repository with transactional claim and lease recovery.
C. Add worker loop with bounded concurrency and graceful shutdown.
D. Adapt existing add/addBulk/status/cancel APIs to durable repository.
E. Inventory and implement missing handlers separately; never silently treat missing handlers as successful.
F. Test multi-worker claims, restart recovery, retry schedule, cancellation races, duplicate enqueue, handler timeout, lease expiry, and dead-letter replay.
G. Deploy behind a feature flag, shadow/compare enqueue behavior, then controlled canary and rollback plan.

## Acceptance criteria
- Delayed jobs survive backend restart.
- Retry schedules survive backend restart and do not depend on in-memory timers.
- Two worker instances cannot claim the same job concurrently.
- Expired leases recover interrupted work.
- Failed persistence is surfaced and enqueue is not reported as accepted.
- Terminal failures are inspectable/replayable.
- Automated tests cover crash/restart and concurrency; migration and rollback are reviewed before production.

## Explicit limitations
This is an architecture proposal only. No Prisma schema, migration, worker implementation, or production Railway changes were made in this phase. The existing cache-backed queue is not made durable by this document.
