import { prisma } from '../prisma';
import { config } from './config';
import { auditLog } from './auditLog';
import { complianceService } from '../services/compliance.service';

export class GDPRCompliance {
  async requestDataExport(userId: string): Promise<void> {
    await complianceService.requestDataExport(userId);
  }

  async exportUserData(userId: string): Promise<object> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true, posts: true, videos: true, stories: true,
        messagesSent: true, sessions: true, securityLogs: true,
        purchaseOrders: true, wallet: { include: { transactions: true } },
        userSettings: true, notificationPrefs: true,
        consentRecords: true,
      },
    });
    if (!user) throw new Error('User not found');
    return { exportedAt: new Date().toISOString(), user };
  }

  async requestAccountDeletion(userId: string, reason?: string): Promise<void> {
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + config.compliance.deletionGracePeriodDays);
    await complianceService.scheduleAccountDeletion(userId, reason, scheduledFor);
    auditLog.log({ userId, action: 'ACCOUNT_DELETION_REQUESTED', severity: 'CRITICAL' });
  }

  async cancelDeletion(userId: string): Promise<void> {
    await complianceService.cancelDeletion(userId);
  }

  async processPendingDeletions(): Promise<number> {
    const result = await complianceService.permanentlyDeleteExpiredAccounts();
    return result.deleted + result.unrecovered;
  }


  async recordConsent(userId: string, type: string, granted: boolean, ipAddress?: string): Promise<void> {
    await prisma.consentRecord.create({
      data: { userId, type, granted, ipAddress },
    });
  }

  async getConsentRecords(userId: string) {
    return prisma.consentRecord.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' },
    });
  }
}