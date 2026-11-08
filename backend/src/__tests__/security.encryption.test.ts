import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import crypto from 'crypto';
import { encryption } from '../security/encryption';

const previous = {
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  ENCRYPTION_SALT: process.env.ENCRYPTION_SALT,
  ENCRYPTION_LEGACY_SALT: process.env.ENCRYPTION_LEGACY_SALT,
};

beforeEach(() => {
  process.env.ENCRYPTION_KEY = 'vanta-test-encryption-key-0123456789abcdef';
  process.env.ENCRYPTION_SALT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0fedcba9876543210';
  delete process.env.ENCRYPTION_LEGACY_SALT;
});

afterEach(() => {
  if (previous.ENCRYPTION_KEY === undefined) delete process.env.ENCRYPTION_KEY; else process.env.ENCRYPTION_KEY = previous.ENCRYPTION_KEY;
  if (previous.ENCRYPTION_SALT === undefined) delete process.env.ENCRYPTION_SALT; else process.env.ENCRYPTION_SALT = previous.ENCRYPTION_SALT;
  if (previous.ENCRYPTION_LEGACY_SALT === undefined) delete process.env.ENCRYPTION_LEGACY_SALT; else process.env.ENCRYPTION_LEGACY_SALT = previous.ENCRYPTION_LEGACY_SALT;
});

describe('encryption salt policy', () => {
  test('new ciphertext is versioned and decrypts with the configured strong salt', () => {
    const encrypted = encryption.encrypt('wallet-private-data');
    expect(encrypted.startsWith('v2:')).toBe(true);
    expect(encryption.decrypt(encrypted)).toBe('wallet-private-data');
  });

  test('new encryption refuses a missing salt instead of using a fixed fallback', () => {
    delete process.env.ENCRYPTION_SALT;
    expect(() => encryption.encrypt('must-not-write')).toThrow('ENCRYPTION_SALT environment variable is required');
  });

  test('legacy unversioned ciphertext can be read only with an explicit legacy salt', () => {
    const legacySalt = 'vanta-encryption-salt';
    process.env.ENCRYPTION_LEGACY_SALT = legacySalt;
    const key = crypto.pbkdf2Sync(process.env.ENCRYPTION_KEY!, Buffer.from(legacySalt, 'utf8'), 100000, 32, 'sha512');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update('legacy-wallet-data', 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const legacy = `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ciphertext}`;
    expect(encryption.decrypt(legacy)).toBe('legacy-wallet-data');
  });
});
