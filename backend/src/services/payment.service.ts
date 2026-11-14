import { prisma } from "../prisma";

/**
 * Legacy placeholder payment service.
 *
 * Coin purchases are intentionally under development and their HTTP endpoints
 * remain in maintenance mode. This service is retained only so older imports
 * fail closed rather than accidentally treating a client callback as proof of
 * payment. Do not wire it into a live purchase route until a provider-backed,
 * replay-safe verifier and atomic fulfillment flow have been implemented.
 */
const PURCHASES_UNDER_DEVELOPMENT =
  "Coin purchases and payment verification are under development and are not available.";

function unavailable(): never {
  throw new Error(PURCHASES_UNDER_DEVELOPMENT);
}

export class PaymentService {
  async initializePayment(_userId: string, _amount: number, _type: "TOPUP" | "PREMIUM") {
    return unavailable();
  }

  async verifyPayment(_transactionId: string, _paymentDetails: unknown) {
    return unavailable();
  }

  async refundPayment(_transactionId: string) {
    return unavailable();
  }

  async createPaymentLink(_userId: string, _amount: number, _type: "TOPUP" | "PREMIUM") {
    return unavailable();
  }

  async webhookHandler(_event: unknown) {
    return unavailable();
  }

  async getPaymentHistory(userId: string, limit: number = 50) {
    return prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }
}

export const paymentService = new PaymentService();
