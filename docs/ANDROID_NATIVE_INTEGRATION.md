# VANTA Android Native Integration

## Goal

Ship VANTA as an Android application while preserving the existing Next.js web application, backend APIs, authentication, and visual identity. Add a native media picker that can present camera capture and the device photo/video library in one selection experience.

## Repository findings

- The current frontend is a Next.js 14 application in `frontend/`, not a static React SPA.
- The Next.js configuration uses server-side Next features and currently sets `X-Frame-Options: DENY`; the production app must be loaded as the WebView's top-level document, never embedded in an iframe.
- The existing PWA manifest is at `frontend/src/app/manifest.ts`.
- There is no Android project or Capacitor configuration in the repository yet.
- The existing chat and story flows use browser file inputs. The story flow already has a multi-file upload/editor pipeline that should be reused.
- Comments are currently text-only in both UI and backend persistence. Media comments require a separate, real backend implementation; a camera control alone is not sufficient.

## Architecture decision

Use Capacitor as the Android host and native-plugin layer, while keeping the Next.js application and API hosted as they are today. Do not attempt to statically export the entire Next.js app without first proving that all routes, server components, authentication, and API dependencies support export. Do not embed the VANTA site in an iframe.

The Android host must load the VANTA origin as the top-level WebView document and expose native capabilities only to the exact trusted VANTA origin. Production navigation must be restricted to the approved VANTA domain(s); external links should leave the app through the system browser. Native bridge calls must validate the calling origin and all arguments.

Before shipping, verify the selected Capacitor loading strategy against the installed Capacitor version and Android WebView behavior. A development/live-reload URL is not automatically a safe production configuration. If the hosted Next.js origin cannot use the Capacitor bridge securely with supported configuration, use a small native Android WebView host with a narrowly scoped, origin-checked JavaScript bridge rather than weakening web security headers or adding an iframe.

## Native media picker

Implement one reusable Android picker surface with:

- A camera tile integrated into the media grid.
- Photos and videos in the same library view.
- Multi-select with clear selected-state and selection count.
- Camera capture that returns a content URI/file to the same selection session.
- Permission handling using the Android system photo picker / MediaStore and camera permission only when needed.
- Android lifecycle handling, cancellation, rotation, and process recreation.
- Safe content URI access; never expose raw filesystem paths to JavaScript.
- Size/type validation and graceful handling of revoked permissions or deleted media.

The web bridge returns selected media as metadata plus a short-lived content reference or a bounded byte transfer. It must not base64-encode large video files into JavaScript memory. The existing VANTA upload pipeline remains responsible for authenticated upload and server-side validation.

## Integration points

1. Chat: replace separate camera/gallery entry points with one picker launch and preserve document sharing as a separate option in the same attachment sheet.
2. Story/status: replace the separate camera and gallery launch buttons with the shared picker; preserve the current editor, multi-file draft flow, quota checks, and upload pipeline.
3. Create post and reel: connect the same picker to existing media selection and upload logic.
4. Profile and VANTA Homes: use the shared picker for profile, cover, and property media selection.
5. Comments: implement authenticated media upload, database persistence, API validation, moderation/visibility rules, and rendering before exposing image/video attachment controls.

## Security and privacy requirements

- Keep Android permissions to the minimum required and request them contextually.
- Do not request broad storage access when the system Photo Picker can satisfy the use case.
- Do not log media bytes, access tokens, private URIs, or personal file names.
- Restrict bridge methods to the first-party VANTA origin and validate MIME type, file size, and operation limits on both client and server.
- Keep all existing backend authorization and upload checks authoritative.
- Provide an accessible web fallback for desktop and browsers where the native bridge is unavailable.

## Delivery gates

- Android debug build compiles.
- Android app launches the production/preview VANTA origin as the top-level document.
- Native bridge is unavailable to untrusted origins.
- Camera capture and mixed photo/video multi-select work on physical Android devices.
- Cancellation, denied permissions, empty library, large files, and interrupted uploads are tested.
- Chat and status uploads work end-to-end without regressions.
- Comment media is not marked complete until backend persistence and rendering are implemented.
- Produce a signed release AAB only after device tests and security review. Do not promote any Android or web build to production before verification.
