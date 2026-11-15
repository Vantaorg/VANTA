export interface TrackingPrivacySettings {
  cookieAnalytics?: boolean;
  cookieMarketing?: boolean;
}

export interface TrackingConsentPreferences {
  analytics?: string;
  marketing?: string;
}

export interface TrackingConsent {
  analytics: boolean;
  marketing: boolean;
}

/**
 * Optional tracking is enabled only when both the privacy switch and its
 * corresponding auditable consent record explicitly allow it.
 */
export function resolveTrackingConsent(
  privacy: TrackingPrivacySettings | null | undefined,
  consent: TrackingConsentPreferences | null | undefined,
): TrackingConsent {
  return {
    analytics: privacy?.cookieAnalytics === true && consent?.analytics === "granted",
    marketing: privacy?.cookieMarketing === true && consent?.marketing === "granted",
  };
}
