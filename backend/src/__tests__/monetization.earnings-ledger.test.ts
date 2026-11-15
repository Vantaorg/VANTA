import { describe, expect, jest, test, beforeEach } from '@jest/globals';

jest.mock('../prisma', () => ({
  prisma: {
    wallet: { findUnique: jest.fn() },
    walletTransaction: { aggregate: jest.fn() },
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
  (prisma.walletTransaction.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 1.23 }, _count: 2 });
  (prisma.giftTransaction.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.creatorSubscription.count as jest.Mock).mockResolvedValue(0);
});

describe('creator earnings summary', () => {
  test('uses completed USD creator-earning ledger rows instead of gift coin totals', async () => {
    const result = await service.getCreatorEarnings('creator1');

    expect(prisma.walletTransaction.aggregate).toHaveBeenCalledTimes(3);
    for (const [args] of (prisma.walletTransaction.aggregate as jest.Mock).mock.calls) {
      expect(args.where).toEqual(expect.objectContaining({
        userId: 'creator1',
        type: 'CREATOR_EARNING',
        currency: 'USD',
        status: 'COMPLETED',
      }));
      expect(args._sum).toEqual({ amount: true });
    }
    expect(result.dailyEarnings.earnings).toBe(1.23);
    expect(result.weeklyEarnings.earnings).toBe(1.23);
    expect(result.monthlyEarnings.earnings).toBe(1.23);
  });
});
