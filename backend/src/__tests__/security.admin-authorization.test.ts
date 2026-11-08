import { describe, expect, jest, test } from '@jest/globals';
import { requireRole } from '../security/authMiddleware';
import { Role, canManageRole } from '../security/rbac';

function response() {
  const res: any = {
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  return res;
}

describe('admin authorization at the API middleware layer', () => {
  test('a normal account cannot invoke an admin action', () => {
    const next = jest.fn();
    const res = response();
    const req: any = { user: { userId: 'ordinary-user', role: Role.USER }, method: 'POST', path: '/users/role' };
    requireRole(Role.ADMIN, Role.SUPER_ADMIN, Role.CEO)(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('a moderator cannot invoke an admin-only action', () => {
    const next = jest.fn();
    const res = response();
    const req: any = { user: { userId: 'moderator-user', role: Role.MODERATOR }, method: 'POST', path: '/admin/reports/1/process' };
    requireRole(Role.ADMIN, Role.SUPER_ADMIN)(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('an authorized admin role passes the role gate', () => {
    const next = jest.fn();
    const req: any = { user: { userId: 'admin-user', role: Role.ADMIN }, method: 'POST', path: '/users/role' };
    requireRole(Role.ADMIN, Role.SUPER_ADMIN, Role.CEO)(req, response(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('privileged account role-change protections', () => {
  test('an ADMIN cannot demote an existing SUPER_ADMIN or CEO', () => {
    expect(canManageRole('ADMIN', 'SUPER_ADMIN', 'USER')).toBe(false);
    expect(canManageRole('ADMIN', 'CEO', 'USER')).toBe(false);
  });

  test('an ADMIN cannot alter another ADMIN account', () => {
    expect(canManageRole('ADMIN', 'ADMIN', 'USER')).toBe(false);
    expect(canManageRole('ADMIN', 'ADMIN', 'ADMIN')).toBe(false);
  });

  test('a CEO may manage ADMIN accounts but cannot change CEO or SUPER_ADMIN accounts', () => {
    expect(canManageRole('CEO', 'ADMIN', 'USER')).toBe(true);
    expect(canManageRole('CEO', 'CEO', 'USER')).toBe(false);
    expect(canManageRole('CEO', 'SUPER_ADMIN', 'USER')).toBe(false);
  });

  test('only SUPER_ADMIN can grant or change executive accounts', () => {
    expect(canManageRole('ADMIN', 'USER', 'SUPER_ADMIN')).toBe(false);
    expect(canManageRole('CEO', 'USER', 'CEO')).toBe(false);
    expect(canManageRole('SUPER_ADMIN', 'USER', 'SUPER_ADMIN')).toBe(true);
    expect(canManageRole('SUPER_ADMIN', 'SUPER_ADMIN', 'ADMIN')).toBe(true);
  });
});
