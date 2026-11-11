// Fork: branded link domains of the signed-in user, or of a team.
import { useApi } from '../useApi';
import { useModified } from '../useModified';

export interface LinkDomainData {
  id: string;
  hostname: string;
  userId: string | null;
  teamId: string | null;
  createdAt: string;
}

export function useLinkDomainsQuery(teamId?: string) {
  const { get, useQuery } = useApi();
  const { modified } = useModified('link-domains');

  return useQuery<LinkDomainData[]>({
    queryKey: ['link-domains', { teamId, modified }],
    queryFn: () => get('/link-domains', teamId ? { teamId } : undefined),
    // Keep showing the current list while it reloads after a change.
    placeholderData: previous => previous,
  });
}
