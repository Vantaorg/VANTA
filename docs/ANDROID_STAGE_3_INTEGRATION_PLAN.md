# Android Stage 3 — Native WebView and File Chooser Proof of Concept

Status: architecture decision updated; native project implementation and build are pending.

Branch: `feat/unified-media-picker-vanta`

## Verified repository facts

- Frontend: Next.js 14 server-rendered app; no static export.
- Canonical production frontend origin: `https://vanta-nu.vercel.app`, explicitly defined in backend code.
- Root npm workspace lockfile is v3; no Capacitor dependencies are present.
- No Android project exists in the repository.
- `/vanta-sw.js` handles VANTA Web Push, notification taps, and incoming-call actions.
- Next.js sets `X-Frame-Options: DENY`; do not weaken it.
- Chat/story use HTML file inputs; story already has a multi-file editor and upload pipeline.
- Comments have no media persistence yet.

## Architecture decision

Use a native Android WebView host loading `https://vanta-nu.vercel.app` as its top-level document. Do not use Capacitor `server.url` for production: the official configuration describes it as a live-reload setting and explicitly says it is not intended for production. Do not statically export the Next.js application as a shortcut.

For the first proof of concept, do not expose a JavaScript-to-native bridge. Android WebView's `WebChromeClient.onShowFileChooser` callback can intercept existing HTML file inputs and launch a native chooser. This preserves the current frontend upload APIs and avoids granting remotely served JavaScript a general native interface.

Restrict top-level in-app navigation to the exact production origin. Open external HTTPS destinations in the system browser. Reject non-HTTPS and untrusted top-level navigation. Do not add `addJavascriptInterface`. Keep `X-Frame-Options: DENY` and all existing backend auth controls unchanged.

If later functionality genuinely requires a JS bridge, use AndroidX WebKit `WebViewCompat.addWebMessageListener` with an exact origin allowlist, strict schema validation, and narrowly scoped methods. No wildcard origin and no raw filesystem paths.

## Service worker handling

Do not disable or replace `/vanta-sw.js`. Verify registration, controlled reload, notification click routing, and existing browser/PWA push subscription behavior. The native shell's notification strategy is a separate decision; a successful WebView load does not prove push delivery.

## Proof-of-concept gates

1. Build and launch a minimal Android application with a WebView loading the exact VANTA production origin.
2. Verify top-level navigation restrictions and external-browser handoff.
3. Verify login, cookie/session persistence, refresh, logout, and authenticated backend API requests.
4. Verify Socket.IO/realtime behavior and deep links.
5. Verify the VANTA service worker registers and controls reloads without breaking the page.
6. Intercept a file input with `onShowFileChooser`; verify cancellation and photo/video selection callbacks.
7. Verify behavior on a physical Android device and more than one Android System WebView version where practical.

## Implementation sequence

1. Create a minimal native Android project and a reproducible CI debug-build workflow.
2. Add a hardened WebView host and an `onShowFileChooser` proof of concept.
3. Add a native unified picker sheet with a camera tile and photo/video selection; return safe content URIs via the file chooser callback.
4. Reuse the native picker automatically across existing chat, story, post, reel, profile, and Homes file inputs.
5. Preserve the browser/PWA file-input behavior as fallback.
6. Implement comment media separately across frontend, authenticated upload API, schema, validation, moderation, persistence, and rendering.

## Release rules

- Do not use Capacitor's production `server.url` configuration.
- Do not add a general JS bridge unless a concrete feature requires it and origin isolation is verified.
- Never log credentials, media bytes, or private content URIs.
- Do not request broad storage access when system Photo Picker is sufficient.
- No production deployment, Play Store release, or signed AAB claim until CI, automated tests, and physical-device tests pass.
