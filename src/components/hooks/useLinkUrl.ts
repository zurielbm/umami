// Fork: the public address of a link, on its branded domain when it has one.
import { getLinkDomainUrl } from '@/lib/link-domain';
import { useLinkDomainsQuery } from './queries/useLinkDomainsQuery';
import { useSlug } from './useSlug';

export function useLinkUrl(teamId?: string) {
  const { getSlugUrl } = useSlug('link');
  const { data } = useLinkDomainsQuery(teamId);
  const domains = data ?? [];

  const getLinkUrl = ({ slug, domainId }: { slug: string; domainId?: string | null }) => {
    const hostname = domainId && domains.find(({ id }) => id === domainId)?.hostname;

    return hostname ? getLinkDomainUrl(hostname, slug) : getSlugUrl(slug);
  };

  return { getLinkUrl, domains };
}
