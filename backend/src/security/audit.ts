import { auditLog } from './auditLog';

/**
 * Audit actions - centralized enum for all auditable events
 */
export enum AuditAction {
  // Authentication
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  REGISTER = 'REGISTER',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  EMAIL_CHANGED = 'EMAIL_CHANGED',
  
  // 2FA
  TWO_FACTOR_ENABLED = 'TWO_FACTOR_ENABLED',
  TWO_FACTOR_DISABLED = 'TWO_FACTOR_DISABLED',
  TWO_FACTOR_VERIFIED = 'TWO_FACTOR_VERIFIED',
  BACKUP_CODES_GENERATED = 'BACKUP_CODES_GENERATED',
  BACKUP_CODE_USED = 'BACKUP_CODE_USED',
  TRUSTED_DEVICE_ADDED = 'TRUSTED_DEVICE_ADDED',
  
  // Sessions
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  ALL_SESSIONS_REVOKED = 'ALL_SESSIONS_REVOKED',
  REFRESH_TOKEN_ROTATED = 'REFRESH_TOKEN_ROTATED',
  
  // Admin actions
  ADMIN_ACTION = 'ADMIN_ACTION',
  USER_BANNED = 'USER_BANNED',
  USER_UNBANNED = 'USER_UNBANNED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  PERMISSION_CHANGED = 'PERMISSION_CHANGED',
  
  // Moderation
  REPORT_SUBMITTED = 'REPORT_SUBMITTED',
  REPORT_REVIEWED = 'REPORT_REVIEWED',
  CONTENT_DELETED = 'CONTENT_DELETED',
  USER_MUTED = 'USER_MUTED',
  
  // Account
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
  ACCOUNT_RECOVERY = 'ACCOUNT_RECOVERY',
  DATA_EXPORT_REQUESTED = 'DATA_EXPORT_REQUESTED',
  
  // Security
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  BRUTE_FORCE_DETECTED = 'BRUTE_FORCE_DETECTED',
  DEVICE_FINGERPRINT_CHANGED = 'DEVICE_FINGERPRINT_CHANGED',
  IP_CHANGED = 'IP_CHANGED',
  
  // Payments
  PAYMENT_INITIATED = 'PAYMENT_INITIATED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  WITHDRAWAL_REQUESTED = 'WITHDRAWAL_REQUESTED',
  WITHDRAWAL_PROCESSED = 'WITHDRAWAL_PROCESSED',
}

/**
 * Enterprise audit logging system
 * All security events are logged with tamper-evident details
 */
class AuditLogger {
  async log(
    userId: string | null | undefined,
    action: AuditAction | string,
    options?: {
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    await auditLog.log({
      userId: userId ?? null,
      action,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
      metadata: options?.metadata,
    });
  }

  logAsync(
    userId: string | null | undefined,
    action: AuditAction | string,
    options?: {
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, any>;
    }
  ): void {
    void this.log(userId, action, options);
  }
}

export const auditLogger = new AuditLogger();