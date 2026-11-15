import { describe, expect, jest, test, beforeEach } from '@jest/globals';

jest.mock('../prisma', () => ({
  prisma: {
    wallet: { findUnique: jest.fn() },
    walletTransaction: { findMany: jest.fn() },
    giftTransaction: { findMany: jest.fn() },
    creatorSubscription: { count: jest.fn() },
  },
}));

import { prisma } from '../prisma';
import { MonetizationService } from '../services/monetization.service';

const service = new MonetizationService();

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.wallet.findUnique as jest.Mock).mockResolvedValue({ userId: 'creator1', earningsBalance: 12.34 });
  (prisma.walletTransaction.findMany as jest.Mock).mockResolvedValue([
    { type: 'CREATOR_EARNING', currency: 'USD', amount: 1.23, metadata: null },
    { type: 'GIFT_RECEIVED', currency: 'VANTA', amount: 0.04, metadata: JSON.stringify({ creatorEarningsUsd: 0.04 }) },
    { type: 'GIFT_RECEIVED', currency: 'VANTA', amount: 70, metadata: JSON.stringify({ autoConverted: true, creatorEarningsUsd: 0.46 }) },
  ]);
  (prisma.giftTransaction.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.creatorSubscription.count as jest.Mock).mockResolvedValue(0);
});

describe('creator earnings summary', () => {
  test('uses completed USD creator-earning ledger rows instead of gift coin totals', async () => {
    const result = await service.getCreatorEarnings('creator1');

    expect(prisma.walletTransaction.findMany).toHaveBeenCalledTimes(3);
    for (const [args] of (prisma.walletTransaction.findMany as jest.Mock).mock.calls) {
      expect(args.where).toEqual(expect.objectContaining({
        userId: 'creator1',
        status: 'COMPLETED',
        OR: [
          { type: 'CREATOR_EARNING', currency: 'USD' },
          { type: 'GIFT_RECEIVED', currency: 'VANTA' },
        ],
      }));
    }
    // 1.23 USD canonical earnings + 0.04 USD legacy earnings; active
    // GIFT_RECEIVED coin credits are deliberately not counted as cash.
    expect(result.dailyEarnings.earnings).toBe(1.27);
    expect(result.weeklyEarnings.earnings).toBe(1.27);
    expect(result.monthlyEarnings.earnings).toBe(1.27);
  });
});
