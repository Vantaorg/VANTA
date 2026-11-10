import { describe, expect, jest, beforeEach, test } from '@jest/globals';

jest.mock('../prisma', () => ({ prisma: { $transaction: jest.fn() } }));
jest.mock('../security/auditLog', () => ({ auditLog: { log: jest.fn().mockResolvedValue(undefined) } }));

import { prisma } from '../prisma';
import { rateLimiter } from '../security/rateLimiter';
import { CryptoUtils } from '../security/crypto';

const tx = {
  $queryRaw: jest.fn().mockResolvedValue([]),
  rateLimit: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
  },
};

function request(ip: string, path: string, body: Record<string, unknown>) {
  return { method: 'POST', path, ip, socket: { remoteAddress: ip }, headers: {}, body } as any;
}
function response() {
  const res: any = {
    headers: {},
    setHeader(name: string, value: unknown) { this.headers[name] = value; return this; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  tx.$queryRaw.mockResolvedValue([]);
  tx.rateLimit.deleteMany.mockResolvedValue({ count: 0 });
  tx.rateLimit.findMany.mockResolvedValue([]);
  tx.rateLimit.create.mockResolvedValue({});
  (prisma.$transaction as jest.Mock).mockImplementation(async (callback: (transaction: any) => unknown) => callback(tx));
});

describe('security-critical shared rate limits', () => {
  test('2FA attempts share an account counter across different IP addresses', async () => {
    const next = jest.fn();
    const accountKey = `POST:/login/2fa:login2fa-account:${CryptoUtils.sha256('user-42')}`;
    await rateLimiter.login2fa(request('192.0.2.10', '/login/2fa', { userId: 'user-42' }), response(), next);
    await rateLimiter.login2fa(request('198.51.100.20', '/login/2fa', { userId: 'user-42' }), response(), next);
    const lockedKeys = tx.$queryRaw.mock.calls.map((call: any[]) => call[1]);
    expect(lockedKeys.filter((key: string) => key === accountKey)).toHaveLength(2);
    expect(next).toHaveBeenCalledTimes(2);
  });

  test('password reset requests share an account counter across different IP addresses', async () => {
    const next = jest.fn();
    const email = 'person@example.test';
    const accountKey = `POST:/forgot-password:password-reset-account:${CryptoUtils.sha256(email)}`;
    await rateLimiter.passwordResetRequest(request('192.0.2.11', '/forgot-password', { email }), response(), next);
    await rateLimiter.passwordResetRequest(request('198.51.100.21', '/forgot-password', { email }), response(), next);
    const lockedKeys = tx.$queryRaw.mock.calls.map((call: any[]) => call[1]);
    expect(lockedKeys.filter((key: string) => key === accountKey)).toHaveLength(2);
  });

  test('fails closed with 503 when shared storage is unavailable', async () => {
    const next = jest.fn();
    const res = response();
    (prisma.$transaction as jest.Mock).mockRejectedValueOnce(new Error('database unavailable'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await rateLimiter.login2fa(request('192.0.2.12', '/login/2fa', { userId: 'user-99' }), res, next);
    expect(res.statusCode).toBe(503);
    expect(next).not.toHaveBeenCalled();
    log.mockRestore();
  });
  test('advisory-lock query returns a Prisma-decodable scalar instead of PostgreSQL void', async () => {
    const next = jest.fn();
    await rateLimiter.api(request('192.0.2.30', '/feed', {}), response(), next);
    const queryTemplate = (tx.$queryRaw as jest.Mock).mock.calls[0][0] as TemplateStringsArray;
    expect(queryTemplate.join('')).toContain('SELECT 1::int AS locked');
    expect(queryTemplate.join('')).toContain('pg_advisory_xact_lock');
    expect(next).toHaveBeenCalledTimes(1);
  });

});
