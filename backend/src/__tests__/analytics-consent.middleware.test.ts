import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../prisma', () => ({
  prisma: {
    userSettings: { findUnique: jest.fn() },
    consentRecord: { findFirst: jest.fn() },
  },
}));

import { prisma } from '../prisma';
import { requireAnalyticsConsent } from '../middleware/analyticsConsent';

describe('analytics consent middleware', () => {
  const settings = prisma.userSettings as unknown as { findUnique: jest.Mock };
  const consent = prisma.consentRecord as unknown as { findFirst: jest.Mock };
  const response = () => {
    const res: any = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    return res;
  };

  beforeEach(() => jest.clearAllMocks());

  it('skips anonymous telemetry without querying or storing user events', async () => {
    const req: any = {};
    const res = response();
    const next = jest.fn();
    await requireAnalyticsConsent(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, skipped: true });
    expect(settings.findUnique).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('skips when the privacy switch is off', async () => {
    settings.findUnique.mockResolvedValue({ cookieAnalytics: false });
    consent.findFirst.mockResolvedValue({ type: 'analytics', granted: true });
    const req: any = { user: { userId: 'user-1' } };
    const res = response();
    const next = jest.fn();
    await requireAnalyticsConsent(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ success: true, skipped: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('skips when consent is denied or unset', async () => {
    settings.findUnique.mockResolvedValue({ cookieAnalytics: true });
    consent.findFirst.mockResolvedValue({ type: 'analytics:NOT_SET', granted: false });
    const req: any = { user: { userId: 'user-1' } };
    const res = response();
    const next = jest.fn();
    await requireAnalyticsConsent(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, skipped: true });
  });

  it('allows events only when both the setting and latest ledger record grant analytics', async () => {
    settings.findUnique.mockResolvedValue({ cookieAnalytics: true });
    consent.findFirst.mockResolvedValue({ type: 'analytics', granted: true });
    const req: any = { user: { userId: 'user-1' } };
    const res = response();
    const next = jest.fn();
    await requireAnalyticsConsent(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('fails closed when the consent store is unavailable', async () => {
    settings.findUnique.mockRejectedValue(new Error('database unavailable'));
    const req: any = { user: { userId: 'user-1' } };
    const res = response();
    const next = jest.fn();
    await requireAnalyticsConsent(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, skipped: true });
  });
});
