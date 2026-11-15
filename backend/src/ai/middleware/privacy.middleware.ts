// =============================================================================
// VANTA AI Privacy Middleware
// AI usage indicators, opt-out, consent validation, data anonymization
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { AI_CONFIG } from '../ai.config';
import { prisma } from '../../prisma';

// Active AI features being used in current request
const AI_FEATURES_HEADER = 'X-AI-Enabled';

/**
 * Inject AI usage indicator headers into all responses
 */
export function injectAIHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader(AI_FEATURES_HEADER, 'true');
  res.setHeader('X-AI-Privacy', 'transparent');
  res.setHeader('X-AI-Opt-Out', '/api/ai/privacy/opt-out');
  next();
}

/**
 * Check if user has opted out of AI features
 */
export async function requireAIConsent(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as any).user?.userId;
  if (!userId) { next(); return; }

  try {
    const [settings, consentRecords, featureFlags] = await Promise.all([
      prisma.userSettings.findUnique({
        where: { userId },
        select: { aiPersonalization: true },
      }),
      prisma.consentRecord.findMany({
        where: { userId, type: { in: ['aiFeatures', 'personalization', 'aiFeatures:NOT_SET', 'personalization:NOT_SET'] } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      prisma.aIFeatureFlag.findMany({
        where: { OR: [{ featureKey: `opt_out:${userId}` }, { featureKey: 'global_ai_disabled' }] },
        select: { featureKey: true, enabled: true },
      }),
    ]);

    const latestConsent = new Map<string, any>();
    for (const record of consentRecords) {
      const key = record.type.endsWith(':NOT_SET') ? record.type.slice(0, -':NOT_SET'.length) : record.type;
      if (!latestConsent.has(key)) latestConsent.set(key, record);
    }
    const explicitlyDenied = ['aiFeatures', 'personalization'].some(key => {
      const record = latestConsent.get(key);
      return Boolean(record && !record.type.endsWith(':NOT_SET') && record.granted === false);
    });
    const userOptedOut = featureFlags.some(flag => flag.featureKey === `opt_out:${userId}` && flag.enabled === false);
    const globallyDisabled = featureFlags.some(flag => flag.featureKey === 'global_ai_disabled' && flag.enabled === true);
    const featureDisabled = userOptedOut || globallyDisabled;

    if (settings?.aiPersonalization === false || explicitlyDenied || featureDisabled) {
      res.status(403).json({
        error: 'AI personalization disabled',
        message: 'AI personalization is disabled by your privacy preferences. You can change this in Privacy Center.',
        code: 'AI_OPTED_OUT',
      });
      return;
    }
    next();
  } catch (error) {
    console.error('[AI Privacy] Unable to verify user preferences:', error instanceof Error ? error.message : error);
    res.status(503).json({
      error: 'AI privacy preferences could not be verified',
      code: 'AI_PRIVACY_CHECK_FAILED',
    });
  }
}

/**
 * Validate user consent for specific AI processing types
 */
export function validateConsent(consentType: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }
    const consentKey: Record<string, string> = {
      training: 'aiFeatures',
      profiling: 'personalization',
      analytics: 'analytics',
    };
    const key = consentKey[consentType] || consentType;
    try {
      const records = await prisma.consentRecord.findMany({
        where: { userId, type: { in: [key, `${key}:NOT_SET`, `ai_${consentType}`] } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
      });
      const canonical = records.find(record => record.type === key || record.type === `${key}:NOT_SET`);
      const latest = canonical || records.find(record => record.type === `ai_${consentType}`);
      if (!latest || latest.type.endsWith(':NOT_SET') || latest.granted !== true) {
        res.status(403).json({
          error: 'Consent required',
          message: `This action requires consent for ${consentType}. Update your privacy settings.`,
          code: 'CONSENT_REQUIRED',
          consentType,
        });
        return;
      }
      next();
    } catch (error) {
      console.error('[AI Privacy] Consent lookup failed:', error instanceof Error ? error.message : error);
      res.status(503).json({ error: 'Consent could not be verified', code: 'CONSENT_CHECK_FAILED' });
    }
  };
}

/**
 * Anonymize personal data before sending to AI services
 */
export function anonymizeForAI(data: any): any {
  if (!data || typeof data !== 'object') return data;

  const anonymized = Array.isArray(data) ? [...data] : { ...data };
  const sensitiveFields = ['email', 'phone', 'phoneNumber', 'passwordHash', 'ipAddress', 'deviceFingerprint', 'fullName'];

  for (const key of Object.keys(anonymized)) {
    if (sensitiveFields.includes(key)) {
      anonymized[key] = undefined;
    } else if (typeof anonymized[key] === 'object' && anonymized[key] !== null) {
      anonymized[key] = anonymizeForAI(anonymized[key]);
    }
  }

  return anonymized;
}

/**
 * Rate limiting for AI endpoints
 */
const aiRequestCounts: Map<string, { count: number; resetAt: number }> = new Map();

export function aiRateLimit(feature: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = (req as any).user?.userId || req.ip || 'anonymous';
    const key = `${feature}:${userId}`;
    const maxRequests = (AI_CONFIG.rateLimit.maxRequests as any)[feature] || 30;
    const now = Date.now();

    let record = aiRequestCounts.get(key);
    if (!record || record.resetAt < now) {
      record = { count: 0, resetAt: now + AI_CONFIG.rateLimit.windowMs };
      aiRequestCounts.set(key, record);
    }

    record.count++;
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    if (record.count > maxRequests) {
      res.status(429).json({
        error: 'Too many AI requests',
        message: `Rate limit exceeded for ${feature}. Try again in ${Math.ceil((record.resetAt - now) / 1000)} seconds.`,
        code: 'AI_RATE_LIMITED',
      });
      return;
    }

    next();
  };
}

/**
 * Log AI interactions for audit
 */
export async function logAIInteraction(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (AI_CONFIG.privacy.logAIInteractions) {
    const userId = (req as any).user?.userId;
    const feature = req.path.split('/').pop() || 'unknown';

    console.log(`[AI Audit] User: ${userId || 'anonymous'} | Feature: ${feature} | Path: ${req.path} | Time: ${new Date().toISOString()}`);
  }
  next();
}

/**
 * Combined privacy middleware
 */
export const privacyMiddleware = [
  injectAIHeaders,
  logAIInteraction,
];