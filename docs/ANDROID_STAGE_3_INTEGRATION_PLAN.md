# Android Stage 3 — Hosted Runtime and Native Bridge Proof of Concept

Status: design gate completed; implementation/build gate still pending.

Branch: `feat/unified-media-picker-vanta`

## Findings verified against the repository

- The frontend is a Next.js 14 server-rendered application. It is not configured as a static export.
- The root npm workspace owns the root `package-lock.json`; the lockfile is v3 and currently contains no `@capacitor/*` packages.
- There is no Android project in the repository tree.
- VANTA registers `/vanta-sw.js` from `frontend/src/lib/pushClient.ts`. It uses Web Push subscriptions and backend device registration. The service worker also handles push events, notification taps, and incoming-call actions.
- The Next.js response headers include `X-Frame-Options: DENY` and a restrictive Permissions-Policy. These must remain intact.
- The app uses authenticated backend APIs and realtime features; these need device-level validation in the Android WebView.

## Stage 3 architecture decision

Use a Capacitor Android shell around the first-party hosted VANTA origin only after validating the exact production origin and runtime behavior. Do not iframe VANTA. Do not package the Next.js app as a static export. Do not set a production `server.url` or broaden `allowNavigation` as a shortcut without a verified origin/bridge security design.

The native bridge must be exposed only to the exact trusted VANTA origin. External links should leave the app through the system browser; untrusted origins and frames must not receive native plugin access.

## Service worker and bridge compatibility

Keep VANTA's existing web service worker and browser Push API path. Capacitor's Android configuration documents `resolveServiceWorkerRequests` (introduced in Capacitor 7; default true) to route service-worker requests through the Capacitor bridge. The proof of concept must verify this behavior on the selected Capacitor version and current Android System WebView. Do not disable VANTA's service worker or silently replace web push behavior.

Capacitor's Android troubleshooting guide warns that service workers can interfere with plugin injection and links a legacy workaround. That workaround is not adopted blindly: the current Capacitor bridge has its own service-worker request handling, and the actual deployed combination must be tested. A successful page load alone is not proof that plugin calls work.

## Proof-of-concept gates (must pass before picker implementation)

1. Load the authenticated, first-party VANTA origin as the Android WebView's top-level document.
2. Verify the native bridge is available after startup and after a service-worker-controlled reload.
3. Verify plugin calls fail closed on untrusted origins, external pages, and iframe contexts.
4. Verify login, refresh, logout, cookie/session behavior, and authenticated API requests.
5. Verify Socket.IO/realtime connections, deep links, and external-link routing.
6. Verify existing web push registration and notification handling remain functional in browser/PWA contexts; document the Android-native push decision separately if Web Push is unsupported in the selected shell.
7. Test Android permission prompts and resume/relaunch behavior on a physical device.

## Implementation sequence after gates

1. Pin a Capacitor major compatible with the repository's Node engine and Android toolchain; add dependencies to the root workspace and regenerate the root lockfile with npm, never hand-edit lockfile entries.
2. Generate and commit the Android project from the pinned CLI.
3. Add a small native diagnostic plugin first. It should expose only a harmless capability/version check and report no secrets or file paths.
4. Add origin-guarded native media picker APIs: Android Photo Picker/MediaStore selection, camera capture, multi-select, and safe content-URI streaming. Avoid broad storage permissions.
5. Connect the frontend through a typed adapter with a browser/PWA fallback.
6. Reuse the adapter in chat and status/story first, preserving the existing upload and publishing flows.
7. Implement comment media end-to-end only after backend schema, authenticated upload, validation, moderation, persistence, and rendering are complete.

## Security and release rules

- Never log auth tokens, raw media, or private content URIs.
- Validate MIME type, size, ownership, and upload authorization on the backend.
- Keep current Next.js security headers; do not weaken iframe restrictions.
- No production deployment, Play Store release, APK, or AAB claim until CI build, automated tests, and physical-device tests pass.
- Keep all work on `feat/unified-media-picker-vanta`; do not merge or promote automatically.
