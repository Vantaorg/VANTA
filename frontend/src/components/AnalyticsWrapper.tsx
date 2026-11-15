"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const ANALYTICS_KEY = "vanta_cookie_analytics_consent";
const MARKETING_KEY = "vanta_cookie_marketing_consent";

function normalizeConsent(value: string | null | undefined): string | null {
  return !value || value === "not_set" ? null : value;
}

export default function AnalyticsWrapper() {
  const { token, isLoading: authLoading } = useAuth();
  const [analyticsConsent, setAnalyticsConsent] = useState<string | null>(null);
  const [marketingConsent, setMarketingConsent] = useState<string | null>(null);
  const [consentLoading, setConsentLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) {
      setConsentLoading(true);
      return () => { cancelled = true; };
    }

    const applyLocalConsent = () => {
      setAnalyticsConsent(normalizeConsent(localStorage.getItem(ANALYTICS_KEY)));
      setMarketingConsent(normalizeConsent(localStorage.getItem(MARKETING_KEY)));
    };

    if (!token) {
      applyLocalConsent();
      setConsentLoading(false);
    } else {
      // A signed-in user's server-side consent record is authoritative. Do not
      // mount third-party analytics from a stale localStorage grant while it is
      // being checked.
      fetch(`${API_BASE_URL}/api/compliance/consent`, {
        method: "GET",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Unable to verify consent preferences");
          return response.json();
        })
        .then((preferences) => {
          if (cancelled) return;
          const analytics = normalizeConsent(preferences?.analytics);
          const marketing = normalizeConsent(preferences?.marketing);
          if (analytics) localStorage.setItem(ANALYTICS_KEY, analytics);
          else localStorage.removeItem(ANALYTICS_KEY);
          if (marketing) localStorage.setItem(MARKETING_KEY, marketing);
          else localStorage.removeItem(MARKETING_KEY);
          setAnalyticsConsent(analytics);
          setMarketingConsent(marketing);
        })
        .catch(() => {
          // Fail closed when the server's current consent cannot be verified.
          if (!cancelled) {
            localStorage.removeItem(ANALYTICS_KEY);
            localStorage.removeItem(MARKETING_KEY);
            setAnalyticsConsent(null);
            setMarketingConsent(null);
          }
        })
        .finally(() => {
          if (!cancelled) setConsentLoading(false);
        });
    }

    const sync = () => applyLocalConsent();
    window.addEventListener("vanta-consent-updated", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("vanta-consent-updated", sync);
    };
  }, [token, authLoading]);

  useEffect(() => {
    if (consentLoading || marketingConsent !== "granted") return;
    const script = document.createElement("script");
    script.src = "https://app.gomine.social/api/visit/v.js";
    script.async = true;
    script.dataset.vantaMarketingConsent = "true";
    document.head.appendChild(script);
    return () => script.remove();
  }, [consentLoading, marketingConsent]);

  const saveConsent = async (analytics: boolean, marketing: boolean) => {
    if (token) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/compliance/consent`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ analytics: analytics ? "granted" : "denied", marketing: marketing ? "granted" : "denied" }),
        });
        if (!response.ok) return;
      } catch {
        return;
      }
    }
    localStorage.setItem(ANALYTICS_KEY, analytics ? "granted" : "denied");
    localStorage.setItem(MARKETING_KEY, marketing ? "granted" : "denied");
    setAnalyticsConsent(analytics ? "granted" : "denied");
    setMarketingConsent(marketing ? "granted" : "denied");
    window.dispatchEvent(new Event("vanta-consent-updated"));
  };

  return (
    <>
      {!consentLoading && analyticsConsent === "granted" && <Analytics />}
      {!consentLoading && analyticsConsent === "granted" && <SpeedInsights />}
      {!consentLoading && analyticsConsent === null && (
        <aside
          role="dialog"
          aria-label="Cookie preferences"
          className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-xl rounded-2xl border border-white/15 bg-[#1F2630] p-4 shadow-2xl"
        >
          <p className="text-sm font-semibold text-white">Your privacy matters</p>
          <p className="mt-1 text-xs leading-5 text-gray-300">
            VANTA uses optional analytics to understand platform usage and improve the experience.
            Essential functionality remains enabled. You can change this choice later in Privacy Center.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveConsent(true, true)}
              className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#1F2630]"
            >
              Accept optional cookies
            </button>
            <button
              type="button"
              onClick={() => saveConsent(false, false)}
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-medium text-white"
            >
              Reject optional cookies
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
