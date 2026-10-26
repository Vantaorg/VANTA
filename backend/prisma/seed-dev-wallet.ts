/**
 * VANTA - administrator initial allocation seed (thin wrapper)
 *
 * Seeds the designated administrator account (vantapp74@gmail.com) with its one-time
 * initial allocation of EXACTLY 1,000,000 VANTA Coins using the shared
 * `admin-dev-wallet` service (src/services/admin-dev-wallet.service.ts).
 *
 * The allocation is REAL, database-backed, idempotent, and issued in every
 * environment — including production. Re-running this script (or the main
 * seed, or a server restart) can never add a duplicate allocation: the grant
 * is gated by a persistent `Wallet.ceoAllocationGrantedAt` marker claimed with
 * an atomic conditional update, and the wallet ledger is checked for an
 * existing allocation transaction first.
 *
 * Usage:
 *   npx ts-node --transpile-only prisma/seed-dev-wallet.ts
 *   npm run seed:dev-wallet
 *
 * Or automatically on server startup.
 */

import { PrismaClient } from '@prisma/client';
import {
  ADMIN_DEV_TX_REFERENCE,
  ADMIN_DEV_TX_TYPE,
  isAdminDevEnvironment,
  seedAdminDevWallet,
} from '../src/services/admin-dev-wallet.service';

const prisma = new PrismaClient();

// Backward-compatible alias used by earlier callers.
export { isAdminDevEnvironment as isDevelopment };

/**
 * Seed the administrator initial allocation. Idempotent and database-gated.
 * Returns the service result for programmatic/observability use.
 */
export async function seedDevWallet(): Promise<ReturnType<typeof seedAdminDevWallet>> {
  const result = await seedAdminDevWallet(prisma);
  switch (result.action) {
    case 'disabled':
      console.log('⏭️  administrator allocation disabled by configuration.');
      break;
    case 'admin-not-found':
      console.log('⚠️  No administrator account found. Run `npx prisma db seed` first to create the admin.');
      break;
    case 'seed-already-available':
      console.log(`✓ administrator initial allocation already present. ${result.admin?.email || result.admin?.username} has ${result.balanceAfter.toLocaleString()} VANTA Coins.`);
      break;
    case 'granted':
      console.log('✓ administrator initial allocation applied.');
      console.log(`Admin (${result.admin?.email || result.admin?.username}) credited with ${result.credited.toLocaleString()} VANTA Coins`);
      console.log(`  - Available Balance: ${result.balanceAfter.toLocaleString()} VANTA Coins`);
      console.log(`  - Transaction: ${ADMIN_DEV_TX_TYPE} (${ADMIN_DEV_TX_REFERENCE})`);
      break;
  }
  return result;
}

// ============================================================================
// RUN (when executed directly as a script)
// ============================================================================

// Only auto-run when executed directly (not when imported)
if (require.main === module) {
  seedDevWallet()
    .catch((e) => {
      console.error('❌ Development wallet seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}