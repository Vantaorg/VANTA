import { NextRequest, NextResponse } from 'next/server';

/**
 * Fail closed on the legacy image-optimization endpoint. VANTA accepts
 * user-controlled AVIF uploads; keep this route blocked until image
 * optimization is separately reviewed and enabled on a patched Next.js build.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/_next/image') {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/_next/image'],
};
