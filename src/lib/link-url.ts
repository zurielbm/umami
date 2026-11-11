// Fork: the public address of a link, built on the server. The interface builds the same
// address with useLinkUrl(); keep the two in step.
import { getLinkDomainUrl } from '@/lib/link-domain';

export function getLinkAddress(
  link: { slug: string; domainId?: string | null },
  options: { origin: string; domains?: { id: string; hostname: string }[] },
): string {
  const hostname =
    link.domainId && options.domains?.find(({ id }) => id === link.domainId)?.hostname;

  if (hostname) {
    return getLinkDomainUrl(hostname, link.slug);
  }

  const base = (process.env.LINKS_URL || `${options.origin}/q`).replace(/\/+$/, '');

  return `${base}/${link.slug}`;
}
