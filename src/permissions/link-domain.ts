// Fork: who may see, add, remove and use branded link domains. Mirrors the link rules.
import { hasPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/constants';
import type { Auth } from '@/lib/types';
import { getLinkDomain, getTeamUser } from '@/queries/prisma';
import { canCreateTeamWebsite } from './team';
import { canCreateWebsite } from './website';

export async function canCreateLinkDomain(auth: Auth, teamId?: string | null) {
  return teamId ? canCreateTeamWebsite(auth, teamId) : canCreateWebsite(auth);
}

export async function canDeleteLinkDomain({ user }: Auth, domainId: string) {
  if (!user) {
    return false;
  }

  const domain = await getLinkDomain(domainId);

  if (!domain) {
    return false;
  }

  if (user.isAdmin) {
    return true;
  }

  if (domain.userId) {
    return user.id === domain.userId;
  }

  if (domain.teamId) {
    const teamUser = await getTeamUser(domain.teamId, user.id);

    return !!teamUser && hasPermission(teamUser.role, PERMISSIONS.websiteDelete);
  }

  return false;
}

/**
 * A link may only use a domain that has the same owner as the link, so one client's
 * domain can never serve another client's links.
 */
export async function isLinkDomainOwnedBy(
  domainId: string,
  owner: { userId?: string | null; teamId?: string | null },
) {
  const domain = await getLinkDomain(domainId);

  if (!domain) {
    return false;
  }

  if (owner.teamId) {
    return domain.teamId === owner.teamId;
  }

  return !!owner.userId && domain.userId === owner.userId;
}
