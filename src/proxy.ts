// Fork: the request proxy for builds made outside Docker. The Docker image replaces this file
// with docker/proxy.ts, which calls the same linkDomainProxy; keep the logic in that function.
import { type NextRequest, NextResponse } from 'next/server';
import { linkDomainProxy } from '@/lib/link-domain-proxy';

export async function proxy(request: NextRequest) {
  return (await linkDomainProxy(request)) ?? NextResponse.next();
}

// API routes and build assets are skipped: Next.js buffers the request body of everything the
// proxy sees, which the tracking and session-replay endpoints must not pay for.
export const config = {
  matcher: '/((?!api/|_next/).*)',
};
