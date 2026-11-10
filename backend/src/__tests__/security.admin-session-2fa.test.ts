import { describe, expect, jest, test } from '@jest/globals';
import { requireAdminTwoFactorVerified } from '../security/authMiddleware';
import { Role } from '../security/rbac';

function response() {
  const res: any = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  return res;
}

describe('administrator session 2FA guard', () => {
  test('rejects an admin session without a 2FA verification timestamp', () => {
    const req: any = { user: { userId: 'admin', role: Role.ADMIN, sessionId: 's1' } };
    const res = response();
    const next = jest.fn();

    requireAdminTwoFactorVerified(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'ADMIN_2FA_REQUIRED' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a verification older than twelve hours', () => {
    const req: any = { user: { userId: 'admin', role: Role.ADMIN, sessionId: 's1', adminTwoFactorVerifiedAt: new Date(Date.now() - 13 * 60 * 60 * 1000) } };
    const res = response();
    const next = jest.fn();

    requireAdminTwoFactorVerified(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a timestamp from the future', () => {
    const req: any = { user: { userId: 'admin', role: Role.SUPER_ADMIN, sessionId: 's1', adminTwoFactorVerifiedAt: new Date(Date.now() + 60_000) } };
    const res = response();
    const next = jest.fn();

    requireAdminTwoFactorVerified(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('allows a recently verified administrator session', () => {
    const req: any = { user: { userId: 'admin', role: Role.CEO, sessionId: 's1', adminTwoFactorVerifiedAt: new Date(Date.now() - 60_000) } };
    const res = response();
    const next = jest.fn();

    requireAdminTwoFactorVerified(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  test('does not allow ordinary users through the administrator guard', () => {
    const req: any = { user: { userId: 'user', role: Role.USER, sessionId: 's1', adminTwoFactorVerifiedAt: new Date() } };
    const res = response();
    const next = jest.fn();

    requireAdminTwoFactorVerified(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});
