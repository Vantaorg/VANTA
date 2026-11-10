import { describe, expect, jest, test, beforeEach } from '@jest/globals';

jest.mock('../prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '../prisma';
import { requireEmailVerified, requireTwoFactorEnabled } from '../security/authMiddleware';

const mockedFindUnique = prisma.user.findUnique as jest.Mock;

function response() {
  const res: any = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  return res;
}

async function flushAsyncMiddleware() {
  await new Promise(resolve => setImmediate(resolve));
}

describe('security prerequisite middleware fails closed', () => {
  beforeEach(() => mockedFindUnique.mockReset());

  test('email verification database errors deny the request', async () => {
    mockedFindUnique.mockRejectedValue(new Error('database unavailable'));
    const req: any = { user: { userId: 'admin-user' } };
    const res = response();
    const next = jest.fn();

    requireEmailVerified(req, res, next);
    await flushAsyncMiddleware();

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ error: 'Security verification unavailable' });
    expect(next).not.toHaveBeenCalled();
  });

  test('2FA eligibility database errors deny the request', async () => {
    mockedFindUnique.mockRejectedValue(new Error('database unavailable'));
    const req: any = { user: { userId: 'admin-user' } };
    const res = response();
    const next = jest.fn();

    requireTwoFactorEnabled(req, res, next);
    await flushAsyncMiddleware();

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ error: 'Security verification unavailable' });
    expect(next).not.toHaveBeenCalled();
  });

  test('unverified email is denied', async () => {
    mockedFindUnique.mockResolvedValue({ emailVerified: false });
    const req: any = { user: { userId: 'admin-user' } };
    const res = response();
    const next = jest.fn();

    requireEmailVerified(req, res, next);
    await flushAsyncMiddleware();

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('disabled 2FA is denied', async () => {
    mockedFindUnique.mockResolvedValue({ twoFactorEnabled: false });
    const req: any = { user: { userId: 'admin-user' } };
    const res = response();
    const next = jest.fn();

    requireTwoFactorEnabled(req, res, next);
    await flushAsyncMiddleware();

    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });
});
