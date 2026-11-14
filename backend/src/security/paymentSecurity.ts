import { prisma } from '../prisma';
import { CryptoUtils } from './crypto';

const FINANCE_MUTATIONS_UNDER_DEVELOPMENT =
  'Legacy payment and payout mutations are disabled. Use the audited wallet flows; coin purchases and payment verification remain under development.';

export class PaymentSecurity {
  async verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean> {
    const expectedSig = CryptoUtils.sha256(`${payload}${secret}`);
    return CryptoUtils.constantTimeCompare(expectedSig, signature);
  }

  /**
   * Legacy direct-credit path intentionally disabled.
   * It marked provider orders completed and credited coins without independent
   * provider verification, idempotent state claiming, or the audited purchase
   * completion service. Do not re-enable until a verified provider flow exists.
   */
  async processPayment(_userId: string, _amount: number, _provider: string, _providerOrderId: string): Promise<void> {
    throw new Error(FINANCE_MUTATIONS_UNDER_DEVELOPMENT);
  }

  /**
   * Legacy withdrawal path intentionally disabled.
   * It bypassed PIN verification, wallet row locking/CAS, ledger reservation,
   * and the withdrawal state machine in WalletService.
   */
  async processWithdrawal(_userId: string, _amount: number, _method: string): Promise<void> {
    throw new Error(FINANCE_MUTATIONS_UNDER_DEVELOPMENT);
  }

  /**
   * Legacy subscription mutation intentionally disabled because it activated
   * subscriptions without a verified payment or an audited wallet debit.
   */
  async handleSubscription(_userId: string, _tier: string, _price: number, _provider: string): Promise<void> {
    throw new Error(FINANCE_MUTATIONS_UNDER_DEVELOPMENT);
  }

  async validateRefund(transactionId: string): Promise<{ valid: boolean; reason?: string }> {
    const tx = await prisma.purchaseOrder.findUnique({ where: { id: transactionId } });
    if (!tx) return { valid: false, reason: 'Transaction not found' };
    if (tx.status !== 'COMPLETED') return { valid: false, reason: 'Transaction not completed' };
    const daysSince = (Date.now() - new Date(tx.createdAt).getTime()) / 86400000;
    if (daysSince > 30) return { valid: false, reason: 'Refund window expired (30 days)' };
    return { valid: true };
  }
}

export const paymentSecurity = new PaymentSecurity();
