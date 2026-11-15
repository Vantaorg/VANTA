"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { useAuth } from "@/context/AuthContext";
import { consentApi, privacyApi } from "@/lib/complianceApi";
import { resolveTrackingConsent } from "@/lib/trackingConsent";

const CONSENT_CHANGED_EVENT = "vanta:tracking-consent-changed";

export default function AnalyticsWrapper() {
  const { token } = useAuth();
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);
  const [marketingAllowed, setMarketingAllowed] = useState(false);
  const previousConsent = useRef({ analytics: false, marketing: false });

  const refreshConsent = useCallback(async () => {
    // Fail closed: anonymous, signed-out, loading, or unavailable consent means
    // no optional analytics or marketing scripts are mounted.
    if (!token) {
      setAnalyticsAllowed(false);
      setMarketingAllowed(false);
      return;
    }

    try {
      const [privacy, consent] = await Promise.all([
        privacyApi.getSettings(),
        consentApi.getPreferences(),
      ]);
      const tracking = resolveTrackingConsent(privacy, consent);
      setAnalyticsAllowed(tracking.analytics);
      setMarketingAllowed(tracking.marketing);
    } catch {
      setAnalyticsAllowed(false);
      setMarketingAllowed(false);
    }
  }, [token]);

  useEffect(() => {
    void refreshConsent();
    const handleConsentChange = () => void refreshConsent();
    window.addEventListener(CONSENT_CHANGED_EVENT, handleConsentChange);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, handleConsentChange);
  }, [refreshConsent]);

  useEffect(() => {
    const wasRevoked =
      (previousConsent.current.analytics && !analyticsAllowed) ||
      (previousConsent.current.marketing && !marketingAllowed);
    previousConsent.current = { analytics: analyticsAllowed, marketing: marketingAllowed };

    // A full document navigation terminates already-loaded third-party code
    // (including referral trackers) when consent is withdrawn.
    if (wasRevoked) window.location.reload();
  }, [analyticsAllowed, marketingAllowed]);

  return (
    <>
      {analyticsAllowed && (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      )}
      {marketingAllowed && (
        <Script
          id="gomine-visit-tracking"
          src="https://app.gomine.social/api/visit/v.js"
          strategy="afterInteractive"
        />
      )}
    </>
  );
}
