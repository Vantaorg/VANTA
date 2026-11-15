import { NextFunction, Request, Response } from 'express';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../security/authMiddleware';

/**
 * Analytics events are optional telemetry. Do not persist them for anonymous
 * visitors or accounts without an explicit, current analytics opt-in.
 * Fail closed if the consent store cannot be read.
 */
export async function requireAnalyticsConsent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const actor = (req as AuthenticatedRequest).user;
  if (!actor?.userId) {
    res.status(200).json({ success: true, skipped: true });
    return;
  }

  try {
    const [settings, latestConsent] = await Promise.all([
      prisma.userSettings.findUnique({
        where: { userId: actor.userId },
        select: { cookieAnalytics: true },
      }),
      prisma.consentRecord.findFirst({
        where: { userId: actor.userId, type: { in: ['analytics', 'analytics:NOT_SET'] } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { type: true, granted: true },
      }),
    ]);

    if (settings?.cookieAnalytics !== true || latestConsent?.type !== 'analytics' || latestConsent.granted !== true) {
      res.status(200).json({ success: true, skipped: true });
      return;
    }

    next();
  } catch {
    // Consent lookup failure must never fall through to event persistence.
    res.status(200).json({ success: true, skipped: true });
  }
}
