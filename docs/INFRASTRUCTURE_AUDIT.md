# VANTA Infrastructure Audit — Production Baseline

**Audit date:** 2026-11-20
**Scope:** Read-only baseline of GitHub main, Railway production, and Vercel metadata.
**Safety:** No production configuration, data, or application code was changed during this audit.

## Executive summary

Railway reports all three production services online with one running replica each, no reported warnings/criticals, and zero failed/crashed deployments in the checked 24-hour window. Vercel's production deployment for the same main commit is READY. These are control-plane indicators, not proof every API or user journey works.

VANTA already has security middleware, rate limiting, cache adapters, an in-process job queue, monitoring metrics and media diagnostics. The highest risks are components that are local/in-memory or depend on optional runtime configuration, so resilience and multi-replica behavior are not established.

## Verified current state

### Hosting and runtime
- GitHub repository: alexjr5500/VANTA, default branch main.
- Latest commit verified from Railway/Vercel metadata: 224d194f0d68dda799dc4c6ebaaea80fa243c34e (PR #240 merge).
- Railway production services:
  - VANTA backend, repo alexjr5500/VANTA, main, region iad, 1 replica, live.
  - vanta-frontend, same repo/branch, region iad, 1 replica, live.
  - Postgres, PostgreSQL 18 image, region iad, 1 replica, live.
- Railway reports all 3 services online, 0 recent failures in the queried 24-hour window, 0 active warnings/criticals, and no pending staged changes.
- Railway has 5 GB volumes attached to backend at /data and PostgreSQL at /var/lib/postgresql/data.
- Backend health-check path is /health; health-check timeout is 300 seconds.
- Backend tracing is disabled.
- Railway-generated backend domain exists; no custom backend domain listed.
- Vercel project vanta is also connected to alexjr5500/VANTA. Its latest production deployment is READY on main, same commit as Railway. Vercel project metadata reports Node 24.x, while repo and frontend package declare Node 22.x.
- Both a Railway frontend service and Vercel frontend project are present. This creates possible hosting/deployment duplication and needs an explicit source-of-truth decision. This audit does not assume either should be removed.

### Code-level observations
- Backend: Node 22, Express, TypeScript, Prisma, PostgreSQL, Socket.IO.
- Frontend: Next.js 15, TypeScript, React, mobile-first web app.
- Backend entrypoint includes Helmet/CSP, strict-origin CORS, compression, body limits, API rate limiting, bot protection, REST routes, Socket.IO authentication and a health endpoint.
- Backend modules include authentication, profiles, feed, posts, reels, stories, messaging, groups/channels, live, gifts, wallet, notifications, Homes, admin, compliance, analytics and AI.
- Security code includes secret-policy startup checks, RBAC, 2FA, audit logging, rate limiting, CSRF, socket security and upload security.
- Upload code supports local storage and optional Cloudinary. Railway backend has a persistent volume, but effective upload directory and Cloudinary mode cannot be verified without reading config values; no secret values were read.
- Cache code attempts Redis via runtime require('ioredis') and falls back to process-local memory. ioredis was not listed as a direct dependency in the inspected root/backend package manifests. No Redis service appears in Railway production inventory. Whether REDIS_URL is set and where it points is unverified.
- The job queue is in-process. It persists pending jobs through the cache service, with a memory fallback. This is not a durable shared queue with independent workers; restart/replica safety is not established.
- Monitoring metrics are process-local, capped at 1,000 points per metric and one-hour retention. This is not durable external observability.
- The backend health route probes the database and media storage, but the inspected handler always responds HTTP 200 and status ok even if the payload reports database unreachable. A platform healthcheck may therefore accept a backend unable to serve database-backed traffic.

## Findings and priority

### P0 — Health/readiness semantics
**Finding:** /health returns HTTP 200 and status ok even when the database probe fails. Railway may mark the service healthy despite an essential dependency being unreachable.
**Action:** Define liveness vs readiness. Keep a lightweight liveness endpoint for the process; readiness should return 503 when critical dependencies are unavailable. Optional cache failure should not fail readiness if fallback is intentional. Test DB reachable/unreachable.
**Status:** Confirmed in source; not changed.

### P0 — Durable background jobs
**Finding:** The queue is process-local and uses cache for persistence. Cache fallback is memory-only. Jobs may be lost on restart when Redis is absent/unavailable, and queue state is not shared between replicas.
**Action:** Implement a durable queue (Redis-backed queue with a real Redis service, or PostgreSQL-backed) with idempotency, bounded retry/backoff, exhausted-job visibility, job metrics and graceful shutdown. Scale workers independently after durability.
**Status:** Confirmed in source; not changed.

### P0 — Queue handler coverage gap
**Finding:** Repository search/source inspection found queue handlers registered only for push delivery and call expiration. The image/video optimizer APIs enqueue image optimization, video transcoding, thumbnail generation, and temporary-file cleanup jobs, but no corresponding registered handlers were found in the inspected main branch. The queue's own worker marks a job failed immediately when no handler is registered.
**Action:** Before adopting a durable queue, inventory every job type and producer, either register a real handler or remove/replace unsupported enqueue calls, and add tests proving every production job type has a handler and its work completes. Do not claim optimization runs merely because a job ID is returned.
**Status:** Confirmed by source search and queue worker behavior; runtime enqueue paths not exhaustively exercised.

### P0 — Queue persistence can retain stale completed jobs
**Finding:** Queue persistence writes pending jobs only when the list is non-empty; when the queue empties, the persisted cache key is not cleared. Completed jobs are not explicitly removed from the persisted snapshot. If the same key survives in Redis, a restart may restore stale jobs and repeat completed work.
**Action:** Persist queue state transitions transactionally (or use a durable broker with acknowledged jobs), delete/clear the snapshot when no pending jobs remain, and add restart/replay regression tests for successful completion, failure, cancellation, and empty queues.
**Status:** Confirmed from source; replay behavior depends on Redis being configured and key state, so not runtime-tested.

### P1 — Delayed and retry work is not restart-safe
**Finding:** Delayed jobs are held in in-memory timers/maps and are not persisted when first scheduled. Retry attempts use an in-memory timeout before re-adding the job. A process restart during either delay can lose that work.
**Action:** Represent scheduled/retry timestamps in durable storage, and let a durable worker reclaim due jobs after restart. Include bounded retries, idempotency, and failure visibility.
**Status:** Confirmed from source; not runtime-tested.

### P1 — Redis dependency/service unverified
**Finding:** Cache code attempts to load ioredis at runtime, but inspected manifests do not declare it directly and Railway inventory has no Redis service. Redis behavior cannot be assumed.
**Action:** Verify dependency resolution and endpoint configuration without exposing values. If Redis is intended, declare the client and provision/connect Redis; test reconnect and shared-instance behavior. Otherwise document memory-only operation and remove Redis-dependent assumptions.
**Status:** Strong evidence from source and inventory; runtime connection/value not inspected.

### P1 — Media storage/CDN
**Finding:** Upload code supports local storage and optional Cloudinary. Backend volume is mounted at /data (5 GB). This is more durable than ephemeral disk but not a scalable object-storage/CDN design. Effective upload path and Cloudinary configuration are unverified.
**Action:** Verify mode/path and test missing-file diagnostics. Plan object storage/CDN migration with signed uploads, processing status, thumbnails, optimized playback and safe deletion. Do not migrate/delete media during audit.
**Status:** Storage design confirmed; production mode/path/CDN behavior unverified.

### P1 — Deployment/runtime alignment and frontend ownership
**Finding:** Repo manifests specify Node 22.x; Vercel project metadata reports Node 24.x. Both Railway and Vercel have frontend deployments for the same repo/commit. This risks divergent build/runtime behavior and unclear release ownership.
**Action:** Decide canonical production frontend host; preserve the secondary host until traffic/domain/rollback dependencies are verified. Align Node version with a tested repository standard and verify builds on both platforms before production settings change.
**Status:** Metadata confirmed; traffic impact not measured.

### P1 — Backups and recovery
**Finding:** Persistent PostgreSQL volume exists (5 GB). Backup schedule, retention, off-provider backup and restore tests were not verified.
**Action:** Verify automated backups, PITR capability, retention, encryption and access. Perform a restore to an isolated environment. Proposed goals: RPO <=15 minutes for critical data where supported, RTO <=60 minutes for critical services; these are not current guarantees.
**Status:** Not verified.

### P2 — Observability
**Finding:** Metrics are process-local and short-retention. Railway tracing is disabled. External durable error tracking/metrics was not verified.
**Action:** Add external error reporting and dashboards for API latency/errors, DB health/connection pressure, queue backlog/failures, media processing, websocket connections, resource use and deployment events. Review privacy before enabling tracing.
**Status:** In-process metrics confirmed; external monitoring not verified.

### P2 — Database performance/resilience
**Finding:** PostgreSQL is a single instance in iad. The Railway service has an HA conversion template, but replicas/failover are not present in current inventory. No DB performance metrics or query audit was run.
**Action:** Review indexes, pagination, N+1 queries, pool sizing, migration safety, connection saturation, and backup/restore. Load-test before replicas or partitioning.
**Status:** Topology confirmed; performance/backup configuration unverified.

## Queue inventory — producer/handler mapping (source inspection)

The current queue declares 21 job constants. Source searches confirmed these enqueue call sites:
- `video:transcode` — `VideoOptimizer.queueOptimization()`
- `thumbnail:generate` — image and video optimizer `queueThumbnail()`
- `image:optimize` — `ImageOptimizer.queueOptimization()`
- `cleanup:temp` — `ImageOptimizer.optimize()` attempts to enqueue cleanup after conversion

Handlers registered in the inspected backend source:
- `push:deliver` — registered by PushNotificationService; retries a push delivery.
- `call:expire` — registered by PushNotificationService; expires stale ringing call sessions.

No handler was found in the default-branch search for the three media job types (`image:optimize`, `video:transcode`, `thumbnail:generate`) or `cleanup:temp`. The job processor logs a missing handler and marks that job failed without retry. This means these queue APIs must not be treated as proof the requested media processing completed.

Additional confirmed call-site issue: the image optimizer's cleanup enqueue passes `{ path: inputPath, delay: 3600000 }` inside the job data object, rather than passing a delay in the queue's options argument. Therefore the queue receives cleanup as an immediate job, and it has no registered handler in inspected source.

This inventory is limited to code search and inspection of the default branch at commit `224d194f0d68dda799dc4c6ebaaea80fa243c34e`. Search results are not exhaustive proofs that a handler cannot exist in dynamically loaded or unindexed code; the inspected files nevertheless show a clear missing-handler risk that should be covered by tests.

## Phased implementation plan
1. Baseline and health/readiness: verify endpoint/storage diagnostics and add readiness semantics with regression tests.
2. Queue reliability: map producers/handlers, select durable broker, implement idempotency/retries/restart recovery.
3. Redis: verify dependency, endpoint and usage; decide provisioned Redis vs alternative; integration tests and graceful degradation.
4. Media: verify current path/mode, plan object storage/CDN migration.
5. Observability: external error capture, alerts, dashboards, tracing and privacy-safe logs.
6. DB reliability: backup/restore drill, indexes/query audit, connection limits and migrations.
7. Deployment governance: choose canonical frontend host, align Node runtime, require CI/smoke tests and rollback.
8. Scale tests: API/feed/messaging/upload/websocket/worker load tests; use measured results for scaling.

## Immediate next actions
- Review health route and add regression test for DB-unreachable readiness.
- Map queue producers/handlers and identify jobs that must never be lost.
- Verify Redis dependency and endpoint without printing secrets.
- Verify uploads resolve to mounted volume and review storage diagnostics.
- Verify backup policy and run a restore drill.
- Decide canonical frontend host and Node runtime.
- Add external observability.
- Load-test and establish baseline.

## Audit limits
This is a read-only baseline from control-plane metadata and selected source files. It did not read environment variable values, inspect database records, run a local build/test suite, run API integration tests, measure traffic, inspect user data, or perform a backup restore. Unverified findings are not proof of absence. No production changes were made.
