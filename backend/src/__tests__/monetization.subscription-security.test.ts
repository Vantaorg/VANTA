import { describe, expect, jest, beforeEach, test } from '@jest/globals';

jest.mock('../prisma', () => ({
  prisma: {
    subscriptionTier: { findUnique: jest.fn() },
    creatorSubscription: { findUnique: jest.fn(), upsert: jest.fn() },
    wallet: { findUnique: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    walletTransaction: { create: jest.fn() },
    walletAuditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('../services/wallet.service', () => ({ walletService: { ensureWallet: jest.fn() } }));
jest.mock('../services/notification.service', () => ({ notificationService: { createNotification: jest.fn() } }));

import { prisma } from '../prisma';
import { MonetizationService } from '../services/monetization.service';

const service = new MonetizationService();
const subscriberWallet = { id: 'wallet-sub', userId: 'subscriber', coinBalance: 1000, lockedCoins: 300, isFrozen: false };
const creatorWallet = { id: 'wallet-creator', userId: 'creator', coinBalance: 0, earningsBalance: 0, isFrozen: false };
const subscription = { id: 'subscription1', subscriberId: 'subscriber', creatorId: 'creator', tier: 'GOLD' };

function transactionMock() {
  return {
    creatorSubscription: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(subscription),
    },
    wallet: {
      findUnique: jest.fn().mockImplementation(async ({ where }: any) =>
        where.userId === 'subscriber' ? subscriberWallet : creatorWallet
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ ...subscriberWallet, coinBalance: 900 }),
      update: jest.fn().mockResolvedValue({ ...creatorWallet, earningsBalance: 0.7, lifetimeEarnings: 0.7 }),
    },
    walletTransaction: { create: jest.fn().mockResolvedValue({}) },
    walletAuditLog: { create: jest.fn().mockResolvedValue({}) },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.subscriptionTier.findUnique as jest.Mock).mockResolvedValue({ price: 100, isActive: true });
  (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback(transactionMock()));
});

describe('creator subscription wallet integrity', () => {
  test('debits only spendable coins with a reservation-aware CAS and writes a ledger row', async () => {
    const tx = transactionMock();
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback(tx));
    const result = await service.subscribe('subscriber', 'creator', 'GOLD');

    expect(result).toEqual(subscription);
    expect(tx.wallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'wallet-sub',
        coinBalance: 1000,
        lockedCoins: 300,
        isFrozen: false,
      }),
    }));
    expect(tx.walletTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'SUBSCRIPTION',
        amount: 100,
        balanceBefore: 1000,
        balance: 900,
        reference: subscription.id,
      }),
    }));
    expect(tx.walletAuditLog.create).toHaveBeenCalled();
  });

  test('rejects a second charge while the current subscription is active', async () => {
    const tx = transactionMock();
    tx.creatorSubscription.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 60_000),
    });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback(tx));

    await expect(service.subscribe('subscriber', 'creator', 'GOLD')).rejects.toThrow('already active');
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });

  test('rejects spend from reserved coins', async () => {
    const tx = transactionMock();
    tx.wallet.findUnique.mockResolvedValue({ ...subscriberWallet, coinBalance: 100, lockedCoins: 100 });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback(tx));

    await expect(service.subscribe('subscriber', 'creator', 'GOLD')).rejects.toThrow('Insufficient available coins');
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });

  test('aborts if the balance/reservation snapshot changed concurrently', async () => {
    const tx = transactionMock();
    tx.wallet.updateMany.mockResolvedValue({ count: 0 });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback(tx));

    await expect(service.subscribe('subscriber', 'creator', 'GOLD')).rejects.toThrow('Balance changed');
    expect(tx.creatorSubscription.upsert).not.toHaveBeenCalled();
  });

  test('rejects an inactive or unknown subscription tier', async () => {
    (prisma.subscriptionTier.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.subscribe('subscriber', 'creator', 'GOLD')).rejects.toThrow('tier is unavailable');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
