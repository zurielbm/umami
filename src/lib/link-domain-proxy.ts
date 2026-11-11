// Fork: routes requests that arrive on a link domain. It runs before every request the proxy
// sees, from both proxy files (src/proxy.ts, and docker/proxy.ts which replaces it in the
// Docker image), so it must stay cheap and must never throw.
import { type NextRequest, NextResponse } from 'next/server';
import {
  getDefaultLinkHostname,
  getRequestHostname,
  getSlugFromPath,
  LINK_DOMAIN_CHECK_PATH,
} from '@/lib/link-domain';
import { getLinkDomainToken } from '@/lib/link-domain-check';
import { isLinkDomainHostname } from '@/lib/link-domain-hosts';
import { linkSlugExists } from '@/queries/prisma/linkDomain';

function rewrite(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();

  url.pathname = pathname;

  return NextResponse.rewrite(url);
}

/** Returns the response for a link-domain request, or nothing when the app should handle it. */
export async function linkDomainProxy(request: NextRequest): Promise<NextResponse | undefined> {
  try {
    const hostname = getRequestHostname(request.headers);

    if (!hostname) {
      return;
    }

    const { pathname } = request.nextUrl;

    // A client's branded domain: it serves that client's links and nothing else.
    if (await isLinkDomainHostname(hostname)) {
      if (pathname === LINK_DOMAIN_CHECK_PATH) {
        return NextResponse.json({ token: getLinkDomainToken(hostname) });
      }

      // Already rewritten: when the server is bound to 127.0.0.1, Next.js sends the rewrite
      // back through this proxy as a second request with the original Host header.
      if (pathname.startsWith(`/ld/${hostname}/`)) {
        return;
      }

      const slug = getSlugFromPath(pathname);

      return slug
        ? rewrite(request, `/ld/${hostname}/${encodeURIComponent(slug)}`)
        : new NextResponse(null, { status: 404 });
    }

    // The instance's own short domain (LINKS_URL without a path): /<slug> works like /q/<slug>.
    // Anything that is not a link falls through, so the app stays reachable on that host.
    if (hostname === getDefaultLinkHostname()) {
      const slug = getSlugFromPath(pathname);

      if (slug && (await linkSlugExists(slug))) {
        return rewrite(request, `/q/${encodeURIComponent(slug)}`);
      }
    }
  } catch {
    // Fall through: a failure here must not block the app.
  }
}
