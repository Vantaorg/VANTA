import { describe, expect, test } from '@jest/globals';
import verificationRoutes from '../routes/verification.routes';
import complianceRoutes from '../routes/compliance.routes';
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

describe('compliance admin route security', () => {
  test('requires session-bound admin 2FA on every privileged compliance endpoint', () => {
    const layers = (complianceRoutes as any).stack as any[];
    const adminPaths = [
      '/audit-logs',
      '/admin/dashboard',
      '/admin/reports/:id/process',
      '/admin/appeals/:id/process',
      '/admin/copyright/:id/process',
      '/admin/child-safety/:id/process',
      '/admin/reports',
      '/admin/appeals',
      '/admin/copyright',
      '/admin/transparency/generate',
      '/admin/community-standards',
      '/admin/policies',
    ];

    for (const path of adminPaths) {
      const route = layers.find((layer) => layer.route?.path === path);
      expect(route).toBeDefined();
      expect(route.route.stack.some((handler: any) => handler.handle === requireAdminTwoFactorVerified)).toBe(true);
    }
  });
});
