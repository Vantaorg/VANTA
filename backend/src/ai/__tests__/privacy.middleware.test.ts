import { jest, describe, beforeEach, expect, test } from '@jest/globals';

jest.mock('../../prisma', () => ({
  prisma: {
    userSettings: { findUnique: jest.fn() },
    consentRecord: { findMany: jest.fn() },
    aIFeatureFlag: { findMany: jest.fn() },
  },
}));

import { prisma } from '../../prisma';
import { requireAIConsent, validateConsent } from '../middleware/privacy.middleware';

const db = prisma as any;
const makeRequest = (userId = 'user-1') => ({ user: { userId }, path: '/recommendations/feed', ip: '127.0.0.1' }) as any;
const makeResponse = () => {
  const response: any = { status: jest.fn(), json: jest.fn() };
  response.status.mockReturnValue(response);
  return response;
};

describe('AI privacy preference enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.userSettings.findUnique.mockResolvedValue({ aiPersonalization: true });
    db.consentRecord.findMany.mockResolvedValue([]);
    db.aIFeatureFlag.findMany.mockResolvedValue([]);
  });

  test('blocks personalized AI when the Privacy Center toggle is disabled', async () => {
    db.userSettings.findUnique.mockResolvedValue({ aiPersonalization: false });
    const res = makeResponse();
    const next = jest.fn();
    await requireAIConsent(makeRequest(), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AI_OPTED_OUT' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('blocks personalized AI when AI features or personalization consent was explicitly denied', async () => {
    db.consentRecord.findMany.mockResolvedValue([
      { id: 'new', type: 'aiFeatures', granted: false, createdAt: new Date() },
      { id: 'old', type: 'aiFeatures', granted: true, createdAt: new Date(Date.now() - 1000) },
    ]);
    const res = makeResponse();
    const next = jest.fn();
    await requireAIConsent(makeRequest(), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('allows personalized AI when preferences are enabled and no denial exists', async () => {
    const res = makeResponse();
    const next = jest.fn();
    await requireAIConsent(makeRequest(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('honors the global AI kill switch but not a disabled user opt-out flag', async () => {
    db.aIFeatureFlag.findMany.mockResolvedValue([
      { featureKey: 'opt_out:user-1', enabled: true },
      { featureKey: 'global_ai_disabled', enabled: true },
    ]);
    const res = makeResponse();
    const next = jest.fn();
    await requireAIConsent(makeRequest(), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('fails closed if privacy preferences cannot be checked', async () => {
    db.userSettings.findUnique.mockRejectedValue(new Error('database unavailable'));
    const res = makeResponse();
    const next = jest.fn();
    await requireAIConsent(makeRequest(), res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AI_PRIVACY_CHECK_FAILED' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('maps training consent to the Privacy Center AI Features consent record', async () => {
    db.consentRecord.findMany.mockResolvedValue([
      { id: 'consent-1', type: 'aiFeatures', granted: true, createdAt: new Date() },
    ]);
    const res = makeResponse();
    const next = jest.fn();
    await validateConsent('training')(makeRequest(), res, next);
    expect(db.consentRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', type: { in: ['aiFeatures', 'aiFeatures:NOT_SET', 'ai_training'] } },
    }));
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('does not treat a NOT_SET consent marker as an affirmative grant', async () => {
    db.consentRecord.findMany.mockResolvedValue([
      { id: 'consent-1', type: 'personalization:NOT_SET', granted: false, createdAt: new Date() },
    ]);
    const res = makeResponse();
    const next = jest.fn();
    await validateConsent('profiling')(makeRequest(), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CONSENT_REQUIRED' }));
    expect(next).not.toHaveBeenCalled();
  });
});
