import { describe, expect, jest, test } from '@jest/globals';
import { FollowerRewardService } from '../services/follower-reward.service';
import { coinsToUsd } from '../config/wallet.config';

describe('follower reward earnings units', () => {
  test('records coin rewards in lifetime earnings as their USD equivalent', async () => {
    const service = new FollowerRewardService();
    const tx: any = {
      wallet: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'creator-wallet', coinBalance: 900 }),
        update: jest.fn().mockResolvedValue({ id: 'claimant-wallet', coinBalance: 200, lifetimeEarnings: 1 }),
      },
      walletTransaction: { create: jest.fn().mockResolvedValue({}) },
    };
    const creatorWallet = { id: 'creator-wallet', coinBalance: 1000, lockedCoins: 100 };
    const claimantWallet = { id: 'claimant-wallet', coinBalance: 100, lifetimeEarnings: 0 };

    await (service as any).transferCoinReward(
      tx,
      { creatorId: 'creator1' },
      'claim1',
      creatorWallet,
      claimantWallet,
      'campaign1',
      'claimant1',
      100,
    );

    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 'claimant-wallet' },
      data: {
        coinBalance: { increment: 100 },
        totalCoinsReceived: { increment: 100 },
        lifetimeEarnings: { increment: coinsToUsd(100) },
      },
    });
  });
});
