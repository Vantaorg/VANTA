import { describe, expect, it } from "vitest";
import { resolveTrackingConsent } from "../trackingConsent";

describe("resolveTrackingConsent", () => {
  it("denies optional tracking when settings or consent are missing", () => {
    expect(resolveTrackingConsent(undefined, undefined)).toEqual({
      analytics: false,
      marketing: false,
    });
  });

  it("requires explicit opt-in in both the privacy setting and consent ledger", () => {
    expect(resolveTrackingConsent(
      { cookieAnalytics: true, cookieMarketing: true },
      { analytics: "granted", marketing: "granted" },
    )).toEqual({ analytics: true, marketing: true });
  });

  it("keeps analytics disabled when either source denies or has not set consent", () => {
    expect(resolveTrackingConsent(
      { cookieAnalytics: true, cookieMarketing: true },
      { analytics: "denied", marketing: "not_set" },
    )).toEqual({ analytics: false, marketing: false });
  });

  it("allows independent analytics and marketing choices", () => {
    expect(resolveTrackingConsent(
      { cookieAnalytics: true, cookieMarketing: false },
      { analytics: "granted", marketing: "granted" },
    )).toEqual({ analytics: true, marketing: false });
  });
});
