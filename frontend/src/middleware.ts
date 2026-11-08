import { NextRequest, NextResponse } from 'next/server';

/**
 * Temporary fail-closed guard for the vulnerable Next.js image optimizer.
 * User-controlled AVIF files are accepted by VANTA, so the optimizer endpoint
 * must not process attacker-supplied images until Next.js is upgraded to a
 * release containing the AVIF/libheif security fix.
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
