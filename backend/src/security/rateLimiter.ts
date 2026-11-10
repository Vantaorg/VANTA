/**
 * Enterprise-grade rate limiting for VANTA.
 * Protects against brute-force, DDoS, and API abuse.
 * Uses Prisma-based storage for persistence across restarts.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { config } from './config';
import { auditLog } from './auditLog';
import { CryptoUtils } from './crypto';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  statusCode?: number;
  keyGenerator?: (req: Request) => string | string[];
  failClosed?: boolean;
  skip?: (req: Request) => boolean;
}

const defaultKeyGenerator = (req: Request): string => {
  const userId = (req as any).user?.userId;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return userId ? `user:${userId}` : `ip:${ip}`;
};

class RateLimiter {
  private configs: Map<string, RateLimitConfig> = new Map();

  /**
   * Create a rate limiter middleware
   */
  createLimiter(limiterConfig: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!config.rateLimit.enabled) {
        if (limiterConfig.failClosed) { res.status(503).json({ error: 'Security rate limiting is temporarily unavailable.' }); return; }
        return next();
      }

      if (limiterConfig.skip && limiterConfig.skip(req)) {
        return next();
      }

      const generated = limiterConfig.keyGenerator ? limiterConfig.keyGenerator(req) : defaultKeyGenerator(req);
      const keys = [...new Set((Array.isArray(generated) ? generated : [generated]).filter(Boolean))];
      const route = `${req.method}:${req.path}`;
      const identifiers = keys.map((key) => `${route}:${key}`).sort();
      try {
        const now = new Date();
        const windowStart = new Date(now.getTime() - limiterConfig.windowMs);
        const decision = await prisma.$transaction(async (tx) => {
          for (const identifier of identifiers) await tx.$queryRaw`SELECT 1::int AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${identifier}))) AS lock_result`;
          await tx.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } });
          const entries = await tx.rateLimit.findMany({ where: { key: { in: identifiers }, createdAt: { gte: windowStart } } });
          const counts = new Map<string, number>();
          for (const entry of entries) counts.set(entry.key, (counts.get(entry.key) || 0) + entry.points);
          const blocked = identifiers.find((id) => (counts.get(id) || 0) >= limiterConfig.max);
          if (blocked) {
            const expiry = entries.filter((entry) => entry.key === blocked).reduce((min, entry) => Math.min(min, entry.expiresAt.getTime()), now.getTime() + limiterConfig.windowMs);
            return { blocked, count: counts.get(blocked) || limiterConfig.max, retryAfter: Math.max(1, Math.ceil((expiry - now.getTime()) / 1000)) };
          }
          for (const identifier of identifiers) await tx.rateLimit.create({ data: { key: identifier, points: 1, expiresAt: new Date(now.getTime() + limiterConfig.windowMs) } });
          return { blocked: null as string | null, count: Math.max(0, ...identifiers.map((id) => counts.get(id) || 0)), retryAfter: 0 };
        });
        if (decision.blocked) {
          res.setHeader('Retry-After', decision.retryAfter);
          res.status(limiterConfig.statusCode || 429).json({ error: limiterConfig.message || 'Too many requests, please try again later', retryAfter: decision.retryAfter });
          await auditLog.log({ userId: (req as any).user?.userId, action: 'RATE_LIMIT_HIT', ipAddress: req.ip, userAgent: req.headers['user-agent'], metadata: { route, key: decision.blocked.slice(0, 80), count: decision.count, limit: limiterConfig.max } });
          return;
        }
        res.setHeader('X-RateLimit-Limit', limiterConfig.max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, limiterConfig.max - decision.count - 1));
        res.setHeader('X-RateLimit-Reset', Math.ceil((now.getTime() + limiterConfig.windowMs) / 1000));
        next();
      } catch (error) {
        console.error('Rate limiter error:', error instanceof Error ? error.message : 'unknown error');
        if (limiterConfig.failClosed) { res.status(503).json({ error: 'Security rate limiting is temporarily unavailable.' }); return; }
        next();
      }
    };
  }

  /**
   * Standard rate limiters for different endpoints
   */
  login = this.createLimiter({
    windowMs: config.rateLimit.login.windowMs,
    max: config.rateLimit.login.max,
    message: 'Too many login attempts. Please try again later.',
    keyGenerator: (req) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const body = req.body as any;
      const identifier = body?.identifier || body?.email;
      const account = typeof identifier === 'string' && identifier.trim() ? `login-account:${CryptoUtils.sha256(identifier.trim().toLowerCase())}` : null;
      return [account, `login-ip:${ip}`].filter(Boolean) as string[];
    },
    failClosed: true,
  });

  register = this.createLimiter({
    windowMs: config.rateLimit.register.windowMs,
    max: config.rateLimit.register.max,
    message: 'Too many registration attempts. Please try again later.',
    keyGenerator: (req) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      return `register:${ip}`;
    },
  });

  passwordReset = this.createLimiter({
    windowMs: config.rateLimit.passwordReset.windowMs,
    max: config.rateLimit.passwordReset.max,
    message: 'Too many password reset attempts. Please try again later.',
    failClosed: true,
    keyGenerator: (req) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const token = typeof (req.body as any)?.token === 'string' ? (req.body as any).token : '';
      return [token ? `reset-password-token:${CryptoUtils.sha256(token)}` : null, `reset-password-ip:${ip}`].filter(Boolean) as string[];
    },
  });

  /**
   * Forgot-password requests, keyed per (normalized email + IP) so a single
   * account cannot be spammed with recovery emails while still allowing the
   * generic response to never disclose whether the account exists.
   */
  passwordResetRequest = this.createLimiter({
    windowMs: config.rateLimit.passwordReset.windowMs,
    max: config.rateLimit.passwordReset.max,
    message: 'Too many password reset attempts. Please try again later.',
    keyGenerator: (req) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const raw = (req.body || {}) as any;
      const email = typeof raw?.email === 'string' ? raw.email.trim().toLowerCase() : '';
      const account = email ? `password-reset-account:${CryptoUtils.sha256(email)}` : null;
      return [account, `password-reset-ip:${ip}`].filter(Boolean) as string[];
    },
    failClosed: true,
  });

  /**
   * Reset-token validation / reset attempts, keyed per IP + a short hash of
   * the submitted token (the raw token is never used in a key or logged).
   */
  resetTokenCheck = this.createLimiter({
    windowMs: parseInt(process.env.RATE_LIMIT_RESET_TOKEN_WINDOW || '900000', 10), // 15 min
    max: parseInt(process.env.RATE_LIMIT_RESET_TOKEN_MAX || '10', 10),
    message: 'Too many reset link checks. Please try again later.',
    keyGenerator: (req) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const raw = (req.body || {}) as any;
      const token = typeof raw?.token === 'string' ? raw.token : '';
      return [token ? `reset-token:${CryptoUtils.sha256(token)}` : null, `reset-token-ip:${ip}`].filter(Boolean) as string[];
    },
    failClosed: true,
  });

  otp = this.createLimiter({
    windowMs: config.rateLimit.otp.windowMs,
    max: config.rateLimit.otp.max,
    message: 'Too many OTP requests. Please try again later.',
    failClosed: true,
  });

  api = this.createLimiter({
    windowMs: config.rateLimit.api.windowMs,
    max: config.rateLimit.api.max,
    message: 'Too many API requests.',
  });

  messaging = this.createLimiter({
    windowMs: config.rateLimit.messaging.windowMs,
    max: config.rateLimit.messaging.max,
    message: 'Too many messages. Please slow down.',
    keyGenerator: (req) => {
      const userId = (req as any).user?.userId;
      return `messaging:${userId || 'unknown'}`;
    },
  });

  upload = this.createLimiter({
    windowMs: config.rateLimit.upload.windowMs,
    max: config.rateLimit.upload.max,
    message: 'Too many uploads. Please try again later.',
  });

  search = this.createLimiter({
    windowMs: config.rateLimit.search.windowMs,
    max: config.rateLimit.search.max,
    message: 'Too many search requests. Please slow down.',
  });

  /**
   * Coin purchase related endpoints (order initialization + payment
   * confirmation). Keyed per authenticated user so an account cannot spam
   * orders or replay completion attempts.
   */
  coinPurchase = this.createLimiter({
    windowMs: 60_000,
    max: 8,
    message: 'Too many purchase attempts. Please slow down and try again.',
  });

  /** Provider payment webhooks — per IP, generous but bounded. */
  coinWebhook = this.createLimiter({
    windowMs: 60_000,
    max: 120,
    message: 'Too many webhook requests.',
  });

  /**
   * 2FA completion during login — keyed per target account (plus IP) so a
   * TOTP brute-force is throttled per user rather than merely per caller IP.
   */
  login2fa = this.createLimiter({
    windowMs: parseInt(process.env.RATE_LIMIT_LOGIN2FA_WINDOW || '900000', 10), // 15 min
    max: parseInt(process.env.RATE_LIMIT_LOGIN2FA_MAX || '10', 10),
    message: 'Too many 2FA attempts. Please try again later.',
    failClosed: true,
    keyGenerator: (req) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const body = (req.body || {}) as any;
      const userId = (req as any).user?.userId || (typeof body?.userId === 'string' ? body.userId : '');
      const account = userId ? `login2fa-account:${CryptoUtils.sha256(userId)}` : null;
      return [account, `login2fa-ip:${ip}`].filter(Boolean) as string[];
    },
  });
}

export const rateLimiter = new RateLimiter();