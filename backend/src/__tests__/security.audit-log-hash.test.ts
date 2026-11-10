import { describe, expect, test } from '@jest/globals';
import { buildAuditHash } from '../security/auditLog';

describe('audit log hash chain', () => {
  const row = {
    id: 'log-1',
    userId: 'user-1',
    action: 'ADMIN_ACTION',
    ipAddress: '192.0.2.1',
    userAgent: 'VANTA test',
    metadata: '{"operation":"freeze"}',
    createdAt: new Date('2026-11-10T12:00:00.000Z'),
  };

  test('produces a deterministic SHA-256 digest for an audit record', () => {
    expect(buildAuditHash('previous', row)).toBe(buildAuditHash('previous', row));
    expect(buildAuditHash('previous', row)).toMatch(/^[a-f0-9]{64}$/);
  });

  test('uses unambiguous field encoding when values contain separators', () => {
    const left = buildAuditHash('previous', {
      ...row,
      action: 'A|B',
      metadata: 'C',
    });
    const right = buildAuditHash('previous', {
      ...row,
      action: 'A',
      metadata: 'B|C',
    });
    expect(left).not.toBe(right);
  });

  test('binds the predecessor hash and every persisted audit field', () => {
    const original = buildAuditHash('previous', row);
    expect(buildAuditHash('different-predecessor', row)).not.toBe(original);
    expect(buildAuditHash('previous', { ...row, action: 'WITHDRAWAL_APPROVED' })).not.toBe(original);
    expect(buildAuditHash('previous', { ...row, metadata: '{"operation":"unfreeze"}' })).not.toBe(original);
    expect(buildAuditHash('previous', { ...row, userId: 'another-user' })).not.toBe(original);
  });
});
