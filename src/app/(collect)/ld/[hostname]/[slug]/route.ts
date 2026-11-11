// Fork: redirect for links on a branded domain. The request proxy rewrites
// https://<link domain>/<slug> to /ld/<link domain>/<slug>; the upstream /q/[slug] route is
// left untouched. The hostname travels in the path because the Host header does not always
// survive the rewrite (Next.js proxies it over HTTP when the server is bound to 127.0.0.1).
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { POST } from '@/app/api/send/route';
import { getLinkDomainUrl } from '@/lib/link-domain';
import { notFound } from '@/lib/response';
import { findLinkByDomain } from '@/queries/prisma/linkDomain';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hostname: string; slug: string }> },
) {
  const { hostname, slug } = await params;
  const link = await findLinkByDomain(hostname.toLowerCase(), slug);

  if (!link) {
    return notFound();
  }

  const payload = {
    type: 'event',
    payload: {
      link: link.id,
      hostname,
      url: `${getLinkDomainUrl(hostname, slug)}${new URL(request.url).search}`,
      referrer: request.headers.get('referer') || undefined,
    },
  };

  const req = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(payload),
  });

  await POST(req);

  return NextResponse.redirect(link.url);
}
