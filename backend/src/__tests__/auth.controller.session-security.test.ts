import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('../security', () => ({
  CryptoUtils: { verifyPassword: jest.fn(), sha256: jest.fn(() => 'challenge-hash') },
  SecurityValidator: {},
  sessionManager: {
    generateTokenPair: jest.fn(),
    createSession: jest.fn(),
    createRememberMeSession: jest.fn(),
    logout: jest.fn(),
  },
  twoFactorAuth: { isDeviceTrusted: jest.fn(), verifyLogin: jest.fn() },
  auditLog: { log: jest.fn().mockResolvedValue(undefined) },
  botProtection: {
    recordLoginAttempt: jest.fn().mockResolvedValue(undefined),
    recordLegitimateActivity: jest.fn().mockResolvedValue(undefined),
    detectSuspiciousLogin: jest.fn().mockResolvedValue(false),
  },
  GDPRCompliance: {},
  config: { auth: { requireEmailVerification: false } },
}));
jest.mock('../security/accountStatus', () => ({
  accountStatusError: jest.fn(() => ({ status: 403, error: 'Account unavailable', code: 'ACCOUNT_UNAVAILABLE' })),
  signAppealToken: jest.fn(() => 'appeal-token'),
}));
jest.mock('../prisma', () => ({
  prisma: {
    user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    session: { update: jest.fn() },
    twoFactorLoginChallenge: { deleteMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
  },
}));
jest.mock('../services/auth.service', () => ({ authService: {} }));

import { login, completeLogin2FA, logout } from '../controllers/auth.controller';
import { prisma } from '../prisma';
import { CryptoUtils, sessionManager, twoFactorAuth, botProtection } from '../security';

const activeUser: any = {
  id: 'user-1',
  email: 'alex@example.test',
  username: 'alex',
  fullName: 'Alex',
  role: 'USER',
  status: 'ACTIVE',
  passwordHash: 'password-hash',
  emailVerified: true,
  twoFactorEnabled: false,
  lockedUntil: null,
};

function request(body: any = {}) {
  return { body, ip: '203.0.113.10', socket: { remoteAddress: '203.0.113.10' }, headers: { 'user-agent': 'security-test' } } as any;
}
function response() {
  const res: any = {
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.user.findFirst as jest.Mock).mockResolvedValue({ ...activeUser });
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...activeUser, twoFactorEnabled: true });
  (prisma.user.update as jest.Mock).mockResolvedValue({});
  (prisma.session.update as jest.Mock).mockResolvedValue({});
  (prisma.twoFactorLoginChallenge.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
  (prisma.twoFactorLoginChallenge.create as jest.Mock).mockResolvedValue({ id: 'challenge-1' });
  (prisma.twoFactorLoginChallenge.findFirst as jest.Mock).mockResolvedValue({ id: 'challenge-1', userId: 'user-1' });
  (prisma.twoFactorLoginChallenge.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  (CryptoUtils.verifyPassword as jest.Mock).mockResolvedValue(true);
  (sessionManager.generateTokenPair as jest.Mock).mockReturnValue({ accessToken: 'access-token', refreshToken: 'refresh-token', expiresIn: 900 });
  (sessionManager.createSession as jest.Mock).mockResolvedValue({ id: 'session-1' });
  (sessionManager.createRememberMeSession as jest.Mock).mockResolvedValue({ accessToken: 'remember-access', refreshToken: 'remember-refresh', expiresIn: 3600 });
  (sessionManager.logout as jest.Mock).mockResolvedValue(undefined);
  (twoFactorAuth.isDeviceTrusted as jest.Mock).mockResolvedValue(false);
  (twoFactorAuth.verifyLogin as jest.Mock).mockResolvedValue({ valid: false, isBackupCode: false });
  (botProtection.detectSuspiciousLogin as jest.Mock).mockResolvedValue(false);
  (botProtection.recordLoginAttempt as jest.Mock).mockResolvedValue(undefined);
});

describe('login session lifecycle', () => {
  test('a failed password never creates an application session', async () => {
    (CryptoUtils.verifyPassword as jest.Mock).mockResolvedValue(false);
    const res = response();
    await login(request({ identifier: 'alex@example.test', password: 'wrong-password' }), res);
    expect(res.statusCode).toBe(401);
    expect(sessionManager.createSession).not.toHaveBeenCalled();
    expect(sessionManager.generateTokenPair).not.toHaveBeenCalled();
    expect(prisma.session.update).not.toHaveBeenCalled();
    expect(botProtection.recordLoginAttempt).toHaveBeenCalledWith('user-1', false, expect.anything());
  });

  test('a successful password login creates and persists a session', async () => {
    const res = response();
    await login(request({ identifier: 'alex@example.test', password: 'correct-password' }), res);
    expect(res.statusCode).toBe(200);
    expect(sessionManager.createSession).toHaveBeenCalledTimes(1);
    expect(prisma.session.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'session-1' } }));
    expect(botProtection.recordLoginAttempt).toHaveBeenCalledWith('user-1', true, expect.anything());
  });

  test('a password-valid 2FA account receives no session before its challenge is completed', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({ ...activeUser, twoFactorEnabled: true });
    const res = response();
    await login(request({ identifier: 'alex@example.test', password: 'correct-password' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.requiresTwoFactor).toBe(true);
    expect(res.body.twoFactorChallenge).toBeDefined();
    expect(res.body.userId).toBe('user-1');
    expect(sessionManager.createSession).not.toHaveBeenCalled();
    expect(prisma.session.update).not.toHaveBeenCalled();
  });

  test('a failed 2FA code never creates a session', async () => {
    const res = response();
    await completeLogin2FA(request({ userId: 'user-1', challengeToken: 'challenge-token-12345678901234567890123456789012', token: '000000' }), res);
    expect(res.statusCode).toBe(401);
    expect(sessionManager.createSession).not.toHaveBeenCalled();
    expect(prisma.session.update).not.toHaveBeenCalled();
  });

  test('a successful 2FA code creates a session, which logout revokes', async () => {
    (twoFactorAuth.verifyLogin as jest.Mock).mockResolvedValue({ valid: true, isBackupCode: false });
    const loginRes = response();
    await completeLogin2FA(request({ userId: 'user-1', challengeToken: 'challenge-token-12345678901234567890123456789012', token: '123456' }), loginRes);
    expect(loginRes.statusCode).toBe(200);
    expect(sessionManager.createSession).toHaveBeenCalledTimes(1);
    expect(prisma.session.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'session-1' } }));

    const logoutRes = response();
    await logout({ user: { userId: 'user-1' }, token: 'access-token' } as any, logoutRes);
    expect(logoutRes.statusCode).toBe(200);
    expect(sessionManager.logout).toHaveBeenCalledWith('user-1', 'access-token');
  });
  test('rejects 2FA completion with only a userId and TOTP, without the password-step challenge', async () => {
    const res = response();
    await completeLogin2FA(request({ userId: 'user-1', token: '123456' }), res);
    expect(res.statusCode).toBe(400);
    expect(twoFactorAuth.verifyLogin).not.toHaveBeenCalled();
    expect(sessionManager.createSession).not.toHaveBeenCalled();
  });

  test('does not create a session if the one-time password-step challenge was consumed concurrently', async () => {
    (twoFactorAuth.verifyLogin as jest.Mock).mockResolvedValue({ valid: true, isBackupCode: false });
    (prisma.twoFactorLoginChallenge.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    const res = response();
    await completeLogin2FA(request({
      userId: 'user-1',
      challengeToken: 'challenge-token-12345678901234567890123456789012',
      token: '123456',
    }), res);
    expect(res.statusCode).toBe(401);
    expect(sessionManager.createSession).not.toHaveBeenCalled();
  });

});
