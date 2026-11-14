import { describe, expect, test } from '@jest/globals';
import verificationRoutes from '../routes/verification.routes';
import { requireAdminTwoFactorVerified } from '../security/authMiddleware';

describe('verification admin route security', () => {
  test('places the session-bound admin 2FA guard before every admin endpoint', () => {
    const layers = (verificationRoutes as any).stack as any[];
    const guardIndex = layers.findIndex((layer) => layer.handle === requireAdminTwoFactorVerified);
    const adminPaths = [
      '/admin/badges',
      '/admin/memberships',
      '/admin/requests',
      '/admin/approve',
      '/admin/reject',
      '/admin/grant-badge',
      '/admin/revoke-badge',
      '/admin/suspend',
      '/admin/plan',
      '/admin/history/:userId',
      '/admin/purchases',
      '/admin/purchases/dashboard',
      '/admin/purchases/:purchaseId/refund',
    ];

    expect(guardIndex).toBeGreaterThanOrEqual(0);

    for (const path of adminPaths) {
      const routeIndex = layers.findIndex((layer) => layer.route?.path === path);
      expect(routeIndex).toBeGreaterThan(guardIndex);
    }
  });
});
