# VANTA Android Native Integration

## Goal

Ship VANTA as an Android application while preserving the existing Next.js web application, backend APIs, authentication, and visual identity. Add a native media picker that integrates with VANTA's existing HTML file-input upload flows.

## Repository findings

- The frontend is a Next.js 14 server-rendered application in `frontend/`; it is not configured as a static export.
- Production frontend origin is explicitly defined in backend code as `https://vanta-nu.vercel.app`.
- The Next.js configuration sets `X-Frame-Options: DENY`; the production app must be loaded as the WebView's top-level document, never embedded in an iframe.
- The existing PWA service worker is `/vanta-sw.js` and supports Web Push, notifications, and incoming-call actions.
- The repository now contains a native Android WebView shell at `android/`.
- `MainActivity` handles trusted-origin navigation and routes HTML file inputs through `WebChromeClient.onShowFileChooser`.
- Chat and story flows already use browser file inputs. The story flow has a multi-file editor/upload pipeline that must be preserved.
- Comments are currently text-only in UI and backend persistence. Media comments require a separate full-stack implementation.

## Architecture decision

Use a small native Android application with an Android WebView loading the first-party VANTA production origin as its top-level document. Do not use Capacitor `server.url` as the production hosting strategy: Capacitor documents that setting as intended for live reload, not production. Do not attempt a static Next.js export unless all server-rendered routes and runtime dependencies are first migrated and verified.

For the first native media integration, avoid a general-purpose JavaScript bridge entirely. Intercept the standard WebView `WebChromeClient.onShowFileChooser` callback and present a native picker. This lets existing `<input type="file">` controls continue to invoke their current upload flows, without exposing a privileged JavaScript object to remotely served page scripts.

The WebView must:
- Load only the exact approved VANTA origin as an in-app top-level page.
- Open external links in the system browser.
- Reject non-HTTPS navigation and untrusted top-level origins.
- Keep JavaScript enabled only because the trusted VANTA application requires it; do not add `addJavascriptInterface`.
- Keep file/content access disabled except for the explicit picker result callback.
- Preserve normal HTTPS subresource loading and existing web security headers.

If a future native capability truly requires a JS bridge, use AndroidX WebKit `WebViewCompat.addWebMessageListener` with an exact allowed-origin rule, strict message schema validation, and no wildcard origin. Do not expose file-system paths, auth tokens, or unrestricted native methods.

## Native media picker

Implement one reusable Android picker surface with:
- A camera action and photo/video library selection in one native sheet.
- Photos and videos in the same library view.
- Multi-select with visible selected state and selection count.
- Camera capture that returns a content URI/file result to the same picker callback.
- Minimal permission requests; prefer Android Photo Picker where possible and request camera permission only when needed.
- Safe content URI access; never expose raw filesystem paths to JavaScript.
- Cancellation, rotation, process recreation, and revoked-permission handling.
- MIME/size validation and bounded streaming; do not base64-encode large videos into JavaScript memory.

The Android shell now presents a native unified Camera / Photos / Files sheet from `onShowFileChooser`. Photos use Android Photo Picker on Android 13+ with a system-picker fallback on older versions; Files use the document provider; Camera capture returns a content URI to the original web upload input.

## Integration points

1. Chat: intercept its existing file inputs and preserve attachment preview, upload, and send behavior.
2. Story/status: preserve the existing editor, multi-file draft flow, quota checks, and upload pipeline.
3. Create post and reel: connect the same picker to existing media inputs and upload logic.
4. Profile and VANTA Homes: use the shared picker for profile, cover, and property media selection.
5. Comments: implement authenticated media upload, persistence, validation, moderation, and rendering before exposing attachment controls.

## Security and privacy

- Never log auth tokens, raw media, private content URIs, or personal file names.
- Validate MIME type, file size, ownership, and upload authorization on the backend.
- Do not request broad storage permissions when Android Photo Picker can satisfy the use case.
- Keep existing backend authorization and upload checks authoritative.
- Provide a browser/PWA fallback for desktop and ordinary mobile browsers.

## Delivery gates

- Android debug build compiles.
- Native Camera / Photos / Files sheet returns content URIs to the existing chat upload input.
- Photo/video multi-select and document selection are verified on a physical Android device.
- WebView loads VANTA as a top-level document.
- External/untrusted navigation is rejected or handed to the system browser.
- Login, refresh, logout, cookies, authenticated APIs, realtime connections, and deep links are verified on device.
- Existing service-worker and PWA push behavior remains intact in browsers.
- Camera capture and mixed photo/video multi-select work on physical Android devices.
- Chat and status uploads pass end-to-end regression tests.
- Comment media is not marked complete until backend persistence and rendering exist.
- Produce a signed AAB only after automated and physical-device tests pass. Do not promote production automatically.
