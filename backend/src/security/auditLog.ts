/**
 * Database-backed, tamper-evident audit logging for VANTA.
 *
 * Every append is serialized with a PostgreSQL transaction-scoped advisory lock.
 * Legacy rows without hashes remain visible but are explicitly reported as
 * unverified; they are never silently treated as integrity-checked.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { config } from './config';
import { CryptoUtils } from './crypto';

export interface AuditEvent {
  userId?: string | null;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
}

type AuditRow = {
  id: string;
  userId: string | null;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: string | null;
  createdAt: Date;
};

const AUDIT_CHAIN_LOCK_ID = 8675309;

export function buildAuditHash(previousHash: string, row: AuditRow): string {
  // JSON array encoding preserves field boundaries. Delimiter concatenation
  // is ambiguous when attacker-controlled metadata or headers contain "|".
  const payload = JSON.stringify([
    previousHash,
    row.id,
    row.createdAt.toISOString(),
    row.userId,
    row.action,
    row.ipAddress,
    row.userAgent,
    row.metadata,
  ]);
  return CryptoUtils.sha256(payload);
}

/**
 * Append inside an existing Prisma transaction. This is exported for callers
 * that must atomically write an audit event alongside their business change.
 */
export async function appendAuditLog(
  tx: Prisma.TransactionClient,
  event: AuditEvent,
): Promise<void> {
  // A transaction-scoped lock prevents two app servers from selecting the same
  // predecessor and creating competing branches in the hash chain.
  // pg_advisory_xact_lock returns PostgreSQL's `void` type. Selecting that
  // value directly makes Prisma try to deserialize an unsupported column.
  // Project a harmless integer instead while still acquiring the same
  // transaction-scoped lock before reading the previous chain entry.
  await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_advisory_xact_lock(${AUDIT_CHAIN_LOCK_ID}) IS NOT NULL AS locked`;

  const previous = await tx.securityLog.findFirst({
    where: { hash: { not: null } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { hash: true, createdAt: true },
  });
  const previousHash = previous?.hash ?? '';
  const actorUserId = typeof event.userId === 'string' && event.userId.trim()
    ? event.userId.trim()
    : null;
  // Keep chain timestamps strictly increasing, even when two appends happen
  // within the same millisecond. The verifier uses this order across restarts.
  const now = Date.now();
  const createdAt = new Date(previous?.createdAt ? Math.max(now, previous.createdAt.getTime() + 1) : now);
  const metadata = event.metadata === undefined ? null : JSON.stringify(event.metadata);

  // Create and then fill the digest in the same transaction. The generated
  // database id is included in the digest, preventing row substitution.
  const row = await tx.securityLog.create({
    data: {
      userId: actorUserId,
      action: event.action,
      ipAddress: event.ipAddress || null,
      userAgent: event.userAgent || null,
      metadata,
      createdAt,
      previousHash,
      hash: null,
    },
  });
  const hash = buildAuditHash(previousHash, row);
  await tx.securityLog.update({
    where: { id: row.id },
    data: { hash },
  });
}

class AuditLogger {
  async log(event: AuditEvent): Promise<void> {
    if (!config.auditLog.enabled) return;

    try {
      await prisma.$transaction(async (tx) => {
        await appendAuditLog(tx, event);
      // The advisory lock serializes appenders; READ COMMITTED ensures the
      // predecessor query after lock acquisition sees the prior commit.
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[AUDIT] ${event.action} by ${event.userId || 'anonymous'} from ${event.ipAddress || 'unknown'}`);
      }
      if (event.severity === 'CRITICAL' || this.isCriticalAction(event.action)) {
        await this.handleCriticalEvent(event);
      }
    } catch (error) {
      console.error('[AUDIT] Failed to log event:', error);
    }
  }

  private isCriticalAction(action: string): boolean {
    const criticalActions = [
      'LOGIN_FAILED', 'RATE_LIMIT_HIT', 'SUSPICIOUS_LOGIN', 'ACCOUNT_LOCKED',
      '2FA_DISABLED', 'ROLE_CHANGED', 'ADMIN_ACTION', 'DATA_EXPORT',
      'ACCOUNT_DELETION', 'PAYMENT_FAILED', 'WITHDRAWAL_REQUESTED', 'BOT_DETECTED',
    ];
    return criticalActions.some((item) => action.startsWith(item) || action.includes(item));
  }

  private async handleCriticalEvent(event: AuditEvent): Promise<void> {
    console.error(`[SECURITY ALERT] ${event.action} - User: ${event.userId || 'anonymous'} - IP: ${event.ipAddress || 'unknown'}`);
  }

  async query(filters: {
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const where: any = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = { contains: filters.action };
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const offset = Math.max(filters.offset ?? 0, 0);
    return prisma.securityLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      skip: offset,
    });
  }

  async verifyIntegrity(): Promise<{
    valid: boolean;
    complete: boolean;
    lastValidHash: string;
    verifiedEntries: number;
    unverifiedLegacyEntries: number;
    firstInvalidLogId?: string;
  }> {
    const logs = await prisma.securityLog.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    let previousHash = '';
    let verifiedEntries = 0;
    let unverifiedLegacyEntries = 0;
    let firstInvalidLogId: string | undefined;
    let chainStarted = false;

    for (const log of logs) {
      if (!log.hash) {
        if (chainStarted) {
          firstInvalidLogId = log.id;
          break;
        }
        unverifiedLegacyEntries += 1;
        continue;
      }

      chainStarted = true;
      if ((log.previousHash ?? '') !== previousHash) {
        firstInvalidLogId = log.id;
        break;
      }

      const expectedHash = buildAuditHash(previousHash, log);
      if (expectedHash !== log.hash) {
        firstInvalidLogId = log.id;
        break;
      }

      previousHash = log.hash;
      verifiedEntries += 1;
    }

    const valid = firstInvalidLogId === undefined;
    return {
      valid,
      complete: valid && unverifiedLegacyEntries === 0,
      lastValidHash: previousHash,
      verifiedEntries,
      unverifiedLegacyEntries,
      ...(firstInvalidLogId ? { firstInvalidLogId } : {}),
    };
  }
}

export const auditLog = new AuditLogger();
