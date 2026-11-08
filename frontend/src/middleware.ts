import { NextRequest, NextResponse } from 'next/server';

/**
 * Fail closed on the legacy image-optimization endpoint. VANTA accepts
 * user-controlled AVIF uploads; block server-side image processing until the
 * patched Next.js upgrade is deployed and image handling is retested.
 */
export function middleware(request: NextRequest) {
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
