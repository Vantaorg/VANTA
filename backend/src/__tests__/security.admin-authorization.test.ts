import { describe, expect, jest, test } from '@jest/globals';
import { requireRole } from '../security/authMiddleware';
import { Role } from '../security/rbac';

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

  test('an authorized admin role passes the role gate', () => {
    const next = jest.fn();
    const req: any = { user: { userId: 'admin-user', role: Role.ADMIN }, method: 'POST', path: '/users/role' };
    requireRole(Role.ADMIN, Role.SUPER_ADMIN, Role.CEO)(req, response(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
