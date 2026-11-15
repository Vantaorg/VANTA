import { describe, expect, jest, test, beforeEach } from '@jest/globals';

jest.mock('../prisma', () => ({
  prisma: {
    walletTransaction: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
    purchaseOrder: { aggregate: jest.fn() },
  },
}));

import { prisma } from '../prisma';
import { AdminService } from '../services/admin.service';

const service = new AdminService();

beforeEach(() => {
  jest.clearAllMocks();
  const transactions = [
    { id: 'gift-out', type: 'GIFT_SENT', status: 'COMPLETED', currency: 'VANTA', amount: 20, fee: 0, balance: 80, description: 'Gift', reference: 'g1', createdAt: new Date('2026-11-14T10:00:00Z'), user: { id: 'u1', username: 'sender' }, metadata: null },
    { id: 'creator-cash', type: 'CREATOR_EARNING', status: 'COMPLETED', currency: 'USD', amount: 0.04, fee: 0, balance: 2.04, description: 'Creator earnings', reference: 'g2', createdAt: new Date('2026-11-14T10:01:00Z'), user: { id: 'u2', username: 'creator' }, metadata: null },
    { id: 'legacy-gift-cash', type: 'GIFT_RECEIVED', status: 'COMPLETED', currency: 'VANTA', amount: 0.04, fee: 0, balance: 0.04, description: 'Legacy cash gift', reference: 'g3', createdAt: new Date('2026-11-14T10:02:00Z'), user: { id: 'u2', username: 'creator' }, metadata: JSON.stringify({ creatorEarningsUsd: 0.04 }) },
  ];
  (prisma.walletTransaction.findMany as jest.Mock).mockImplementation((args: any) => {
    if (args?.where?.type === 'GIFT_RECEIVED' && args?.select) {
      return Promise.resolve([{ amount: 0.04, status: 'COMPLETED', metadata: JSON.stringify({ creatorEarningsUsd: 0.04 }) }]);
    }
    return Promise.resolve(transactions);
  });
  (prisma.walletTransaction.count as jest.Mock).mockResolvedValue(3);
  (prisma.walletTransaction.aggregate as jest.Mock).mockImplementation((args: any) => {
    const where = args.where;
    const amount =
      where.status === 'COMPLETED' && where.currency === 'VANTA' ? 100.04 :
      where.status === 'COMPLETED' && where.currency === 'USD' ? 1.25 :
      where.status === 'PENDING' && where.currency === 'VANTA' ? 30 :
      where.status === 'PENDING' && where.currency === 'USD' ? 5 :
      where.status === 'REVERSED' && where.currency === 'VANTA' ? 10 :
      where.status === 'REVERSED' && where.currency === 'USD' ? 2 : 0;
    return Promise.resolve({ _sum: { amount } });
  });
  (prisma.purchaseOrder.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 7 } });
});

describe('admin finance currency presentation', () => {
  test('keeps USD and VANTA totals separate and signs outgoing movements correctly', async () => {
    const result = await service.getFinanceTransactions({ page: 1, limit: 50 });

    expect(result.summary).toEqual({
      totalProcessedUsd: 1.29,
      totalProcessedVanta: 100,
      pendingReviewUsd: 5,
      pendingReviewVanta: 30,
      refundsUsd: 2,
      refundsVanta: 10,
      totalPurchaseRevenue: 7,
      count: 3,
    });
    expect(result.transactions[0]).toEqual(expect.objectContaining({
      id: 'gift-out', currency: 'VANTA', amount: 20, displayAmount: -20,
    }));
    expect(result.transactions[1]).toEqual(expect.objectContaining({
      id: 'creator-cash', currency: 'USD', displayAmount: 0.04,
    }));
    expect(result.transactions[2]).toEqual(expect.objectContaining({
      id: 'legacy-gift-cash', currency: 'USD', displayAmount: 0.04,
    }));
  });
});
