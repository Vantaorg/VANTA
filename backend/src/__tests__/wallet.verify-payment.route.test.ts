import { verifyPayment } from '../controllers/wallet.controller';
import { prisma } from '../prisma';
import { blockchainTxVerifier, BlockchainTxVerificationError } from '../services/blockchain-verifier.service';

jest.mock('../prisma', () => ({ prisma: { purchaseOrder: { findFirst: jest.fn(), updateMany: jest.fn() } } }));
jest.mock('../services', () => ({ walletService: {} }));
jest.mock('../services/coin-payment.service', () => ({
  coinPaymentService: {}, CoinPaymentUnavailableError: class CoinPaymentUnavailableError extends Error {},
}));
jest.mock('../services/blockchain-verifier.service', () => ({
  blockchainTxVerifier: { verifyTransaction: jest.fn() },
  BlockchainTxVerificationError: class BlockchainTxVerificationError extends Error {
    code: string; transient: boolean;
    constructor(code: string, message: string, transient = false) { super(message); this.code = code; this.transient = transient; }
  },
}));
jest.mock('../config/coin-payments.config', () => ({
  getCoinPaymentMode: () => 'live', COIN_PAYMENT_MODE: { LIVE: 'live', TEST: 'test' },
  COIN_PAYMENT_STATUS: { COMPLETED: 'COMPLETED', REFUNDED: 'REFUNDED', PENDING: 'PENDING', PROCESSING: 'PROCESSING' },
  SUPPORTED_COIN_PAYMENT_NETWORKS: ['usdt-bep20', 'usdc-base'],
  getCoinPaymentDepositAddress: () => '0x7fa9677c65272d80b06cb0c3a9bbeeba8f95db56',
}));
jest.mock('../config/blockchain-networks.config', () => ({ getMinBlockchainConfirmations: () => 2 }));

const txHash = `0x${'a'.repeat(64)}`;
const order = { id: 'order-1', userId: 'user-1', status: 'PENDING', paymentMode: 'live', paymentMethod: 'usdt-bep20', amount: 5, coins: 500 };
const mockRes = () => {
  const res: any = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};
async function call(hash: unknown = txHash, lookup: any = order) {
  const req: any = { user: { userId: 'user-1' }, body: { orderId: 'order-1', txHash: hash } };
  (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(lookup);
  const res = mockRes();
  await verifyPayment(req, res);
  return res;
}

describe('POST /wallet/verify-payment route', () => {
  beforeEach(() => { jest.clearAllMocks(); process.env.NODE_ENV = 'development'; });

  test('rejects malformed and nonexistent hashes without persisting or crediting', async () => {
    const malformed = await call('wrong hash');
    expect(malformed.status).toHaveBeenCalledWith(400);
    expect(malformed.json.mock.calls[0][0].code).toBe('INVALID_TX_HASH');
    expect(blockchainTxVerifier.verifyTransaction).not.toHaveBeenCalled();
    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(order);
    (blockchainTxVerifier.verifyTransaction as jest.Mock).mockRejectedValueOnce(
      new BlockchainTxVerificationError('TRANSACTION_NOT_FOUND', 'not found')
    );
    const nonexistent = mockRes();
    await verifyPayment({ user: { userId: 'user-1' }, body: { orderId: order.id, txHash } } as any, nonexistent);
    expect(nonexistent.status).toHaveBeenCalledWith(400);
    expect(nonexistent.json.mock.calls[0][0].terminal).toBe(true);
    expect(prisma.purchaseOrder.updateMany).not.toHaveBeenCalled();
  });

  test.each([
    ['wrong token', 'WRONG_TOKEN'], ['wrong recipient', 'WRONG_RECIPIENT'],
    ['underpaid amount', 'AMOUNT_MISMATCH'], ['wrong chain', 'WRONG_NETWORK'],
  ])('rejects %s as terminal without credit', async (_label, code) => {
    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(order);
    (blockchainTxVerifier.verifyTransaction as jest.Mock).mockRejectedValueOnce(new BlockchainTxVerificationError(code, code));
    const res = mockRes();
    await verifyPayment({ user: { userId: 'user-1' }, body: { orderId: order.id, txHash } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toMatchObject({ terminal: true, code });
    expect(prisma.purchaseOrder.updateMany).not.toHaveBeenCalled();
  });

  test('a matching on-chain transaction awaiting confirmations is pending only', async () => {
    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(order);
    (blockchainTxVerifier.verifyTransaction as jest.Mock).mockRejectedValueOnce(new BlockchainTxVerificationError('LOW_CONFIRMATIONS', 'waiting'));
    const res = mockRes();
    await verifyPayment({ user: { userId: 'user-1' }, body: { orderId: order.id, txHash } } as any, res);
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json.mock.calls[0][0].pending).toBe(true);
    expect(prisma.purchaseOrder.updateMany).not.toHaveBeenCalled();
  });

  test('confirmed matching transaction only records reference, never credits in route', async () => {
    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(order).mockResolvedValueOnce(null);
    (blockchainTxVerifier.verifyTransaction as jest.Mock).mockResolvedValueOnce({ verified: true, confirmations: 2 });
    (prisma.purchaseOrder.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
    const res = mockRes();
    await verifyPayment({ user: { userId: 'user-1' }, body: { orderId: order.id, txHash } } as any, res);
    expect(prisma.purchaseOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { providerReference: txHash } }));
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json.mock.calls[0][0].pending).toBe(true);
    expect(prisma.wallet).toBeUndefined();
  });

  test('rejects a hash already attached to another order', async () => {
    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(order).mockResolvedValueOnce({ id: 'another-order' });
    (blockchainTxVerifier.verifyTransaction as jest.Mock).mockResolvedValueOnce({ verified: true, confirmations: 2 });
    const res = mockRes();
    await verifyPayment({ user: { userId: 'user-1' }, body: { orderId: order.id, txHash } } as any, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].code).toBe('TX_ALREADY_USED');
    expect(prisma.purchaseOrder.updateMany).not.toHaveBeenCalled();
  });

  test('does not store the hash when the order status changed before the update', async () => {
    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(order).mockResolvedValueOnce(null);
    (blockchainTxVerifier.verifyTransaction as jest.Mock).mockResolvedValueOnce({ verified: true, confirmations: 2 });
    if ((prisma.purchaseOrder.updateMany as any)._isMockFunction) {
      (prisma.purchaseOrder.updateMany as jest.Mock).mockResolvedValueOnce({ count: 0 });
    }
    const res = mockRes();
    await verifyPayment({ user: { userId: 'user-1' }, body: { orderId: order.id, txHash } } as any, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.purchaseOrder.updateMany).toHaveBeenCalledTimes(1);
  });
});
