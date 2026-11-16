#!/usr/bin/env node
'use strict';

/**
 * One-time, narrowly scoped production role promotion.
 *
 * Usage:
 *   CONFIRM_SUPER_ADMIN_USERNAME=vanta \
 *     railway run --service <backend-service> node scripts/promote-super-admin.cjs --username vanta --confirm
 *
 * This script never creates an account, changes credentials, or touches any
 * other user. It updates only the exact username explicitly confirmed.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const usernameArg = args[args.indexOf('--username') + 1];
  const confirmed = args.includes('--confirm');
  const username = String(usernameArg || '').trim().replace(/^@/, '').toLowerCase();

  if (username !== 'vanta' || process.env.CONFIRM_SUPER_ADMIN_USERNAME !== 'vanta' || !confirmed) {
    throw new Error(
      'Refusing to run. This one-time operation requires --username vanta --confirm and CONFIRM_SUPER_ADMIN_USERNAME=vanta.'
    );
  }

  const target = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, role: true },
  });

  if (!target) {
    throw new Error('No existing @vanta account was found. No account was created or changed.');
  }

  if (target.role !== 'SUPER_ADMIN') {
    const changed = await prisma.user.updateMany({
      where: { id: target.id, username, role: target.role },
      data: { role: 'SUPER_ADMIN' },
    });
    if (changed.count !== 1) {
      throw new Error('The account role changed concurrently. No further action was taken; inspect the account and retry.');
    }
  }

  const verified = await prisma.user.findUnique({
    where: { id: target.id },
    select: { id: true, username: true, role: true },
  });

  if (!verified || verified.role !== 'SUPER_ADMIN') {
    throw new Error('Role promotion could not be verified.');
  }

  console.log(JSON.stringify({
    success: true,
    username: '@' + verified.username,
    previousRole: target.role,
    currentRole: verified.role,
    changed: target.role !== verified.role,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[SUPER_ADMIN_PROMOTION_FAILED]', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
