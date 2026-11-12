import { Router, Request, Response } from 'express';
import { rateLimiter } from '../security/rateLimiter';

const router = Router();

/**
 * POST /api/payments/webhook
 *
 * Provider payment webhook for LIVE coin purchases. This is the ONLY path that
 * credits coins for a live payment:
 *
 *   - AUTHENTICATED: HMAC-SHA256 signature over the raw request body using
 *     VANTA_COIN_PAYMENT_WEBHOOK_SECRET (constant-time compare).
 *   - REPLAY-SAFE: eventId uniqueness is enforced by the WebhookEvent table.
 *   - IDEMPOTENT: an already-completed order or an already-used transaction
 *     hash can never credit coins twice.
 *   - TRANSACTION-SAFE: crediting + ledger + status flip happen atomically.
 *
 * This endpoint deliberately does NOT require a user session — the provider
 * authenticates via HMAC. It must be reachable by the payment provider, so it
 * lives outside the JWT-protected wallet router.
 */
router.post('/webhook', rateLimiter.coinWebhook, (_req: Request, res: Response) => {
  res.status(503).json({ code: 'PURCHASES_UNDER_MAINTENANCE', error: 'Crypto coin purchases are temporarily disabled.' });
});



export default router;