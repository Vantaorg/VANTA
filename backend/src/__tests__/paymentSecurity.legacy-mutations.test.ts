import { PaymentSecurity } from '../security/paymentSecurity';
import { prisma } from '../prisma';
import { describe, expect, test, jest } from '@jest/globals';

jest.mock('../prisma', () => ({
  prisma: {
    purchaseOrder: { findUnique: jest.fn() },
  },
}));

const paymentSecurity = new PaymentSecurity();

describe('PaymentSecurity legacy finance mutations', () => {
  test('does not credit coins through the unverified legacy payment path', async () => {
    await expect(paymentSecurity.processPayment('user1', 100, 'legacy', 'order1'))
      .rejects.toThrow('Legacy payment and payout mutations are disabled');
    expect(prisma.purchaseOrder.findUnique).not.toHaveBeenCalled();
  });

  test('does not create withdrawals through the unaudited legacy payout path', async () => {
    await expect(paymentSecurity.processWithdrawal('user1', 10, 'USDT'))
      .rejects.toThrow('Legacy payment and payout mutations are disabled');
  });

  test('does not activate subscriptions through the unverified legacy path', async () => {
    await expect(paymentSecurity.handleSubscription('user1', 'gold', 10, 'legacy'))
      .rejects.toThrow('Legacy payment and payout mutations are disabled');
  });
});
