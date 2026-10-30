# Android native bridge — stage 2 audit

## Findings

- VANTA is a server-rendered Next.js 14 app, not a static-exported frontend. The Android host must load the first-party app as its top-level document; do not iframe it or weaken `X-Frame-Options: DENY`.
- VANTA has a custom `/vanta-sw.js` push worker registered by `frontend/src/lib/pushClient.ts`.
- Capacitor's current Android troubleshooting documentation warns that service workers can prevent native plugin JavaScript injection. The documented workaround must be tested before wiring native plugin calls. Browser/PWA push behavior must remain intact.
- The repository currently has no Android project or Capacitor dependency/configuration.

## Required proof-of-concept gates

1. Load the first-party VANTA origin as the Android WebView main frame.
2. Verify a native plugin is injected and callable after VANTA startup and service-worker behavior.
3. Deny plugin access from iframes and non-VANTA origins.
4. Preserve browser push behavior for ordinary web/PWA users; use a deliberate native push strategy in Android if required.
5. Verify auth/session storage, authenticated API calls, Socket.IO/WebSocket, deep links, and external-link handling.
6. Only then implement the camera-in-gallery picker and connect it to chat/status upload pipelines.

## Safety rule

Do not add a production `server.url`, broad `allowNavigation`, or permissive JavaScript bridge without verifying the exact origin and bridge behavior. Do not weaken web security headers to make the Android wrapper work.