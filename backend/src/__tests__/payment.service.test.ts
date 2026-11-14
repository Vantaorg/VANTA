import { PaymentService } from '../services/payment.service';
import { prisma } from '../prisma';

jest.mock('../prisma', () => ({
  prisma: {
    walletTransaction: { findMany: jest.fn() },
  },
}));

const paymentService = new PaymentService();
const unavailableMessage = 'Coin purchases and payment verification are under development and are not available.';

describe('Legacy PaymentService fails closed while coin purchases are under development', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([
    ['initializePayment', () => paymentService.initializePayment('user1', 100, 'TOPUP')],
    ['verifyPayment', () => paymentService.verifyPayment('tx1', { paid: true })],
    ['refundPayment', () => paymentService.refundPayment('tx1')],
    ['createPaymentLink', () => paymentService.createPaymentLink('user1', 100, 'TOPUP')],
    ['webhookHandler', () => paymentService.webhookHandler({ type: 'payment.succeeded' })],
  ])('%s cannot mutate payment or coin state', async (_method, invoke) => {
    await expect(invoke()).rejects.toThrow(unavailableMessage);
    expect(prisma.walletTransaction.findMany).not.toHaveBeenCalled();
  });

  test('keeps read-only payment history available', async () => {
    (prisma.walletTransaction.findMany as jest.Mock).mockResolvedValue([{ id: 'tx1' }]);
    await expect(paymentService.getPaymentHistory('user1')).resolves.toEqual([{ id: 'tx1' }]);
    expect(prisma.walletTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user1' },
      take: 50,
    }));
  });

  test('bounds payment history limit', async () => {
    (prisma.walletTransaction.findMany as jest.Mock).mockResolvedValue([]);
    await paymentService.getPaymentHistory('user1', 10000);
    expect(prisma.walletTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });
});
