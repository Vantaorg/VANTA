import { describe, expect, test } from '@jest/globals';
import { AppError } from '../utils/api-error';
import { classifyProfileError } from '../controllers/profile.controller';

describe('public profile error classification', () => {
  test.each([
    ['ACCOUNT_SUSPENDED', 'This account has been suspended by VANTA moderation.'],
    ['ACCOUNT_BANNED', 'This account has been banned from VANTA.'],
  ])('preserves the %s machine-readable code', (code, message) => {
    const result = classifyProfileError(new AppError(403, code, message));
    expect(result).toEqual({ status: 403, message, code });
  });

  test('does not classify ordinary private-profile errors as moderation actions', () => {
    expect(classifyProfileError(new Error('Private profile'))).toEqual({
      status: 403,
      message: 'Private profile',
    });
  });

  test('database errors remain server errors instead of looking like missing profiles', () => {
    const error = Object.assign(new Error('column User.suspendedAt does not exist'), { code: 'P2022' });
    expect(classifyProfileError(error)).toEqual({
      status: 500,
      message: 'Failed to load profile',
    });
  });
});
