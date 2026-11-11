// Fork: branded link domains owned by the signed-in user or one of their teams.
import { z } from 'zod';
import { uuid } from '@/lib/crypto';
import { getReservedHostnames, normalizeHostname } from '@/lib/link-domain';
import { clearLinkDomainHostnames } from '@/lib/link-domain-hosts';
import { parseRequest } from '@/lib/request';
import { badRequest, json, unauthorized } from '@/lib/response';
import { canViewTeam } from '@/permissions';
import { canCreateLinkDomain } from '@/permissions/link-domain';
import {
  createLinkDomain,
  getLinkDomainByHostname,
  getTeamLinkDomains,
  getUserLinkDomains,
} from '@/queries/prisma/linkDomain';

export async function GET(request: Request) {
  const schema = z.object({
    teamId: z.uuid().optional(),
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { teamId } = query;

  if (teamId) {
    if (!(await canViewTeam(auth, teamId))) {
      return unauthorized();
    }

    return json(await getTeamLinkDomains(teamId));
  }

  return json(await getUserLinkDomains(auth.user.id));
}

export async function POST(request: Request) {
  const schema = z.object({
    hostname: z.string().trim().min(1).max(300),
    teamId: z.uuid().nullable().optional(),
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { teamId } = body;

  if (!(await canCreateLinkDomain(auth, teamId))) {
    return unauthorized();
  }

  const hostname = normalizeHostname(body.hostname);

  if (!hostname) {
    return badRequest({ message: 'Enter a domain name such as go.example.com.' });
  }

  // Claiming the instance's own address would make the app answer 404 on it.
  if (getReservedHostnames(request.headers).includes(hostname)) {
    return badRequest({ message: 'This domain is already used by this Umami instance.' });
  }

  if (await getLinkDomainByHostname(hostname)) {
    return badRequest({ message: 'That domain is already added.' });
  }

  const domain = await createLinkDomain({
    id: uuid(),
    hostname,
    ...(teamId ? { teamId } : { userId: auth.user.id }),
  });

  clearLinkDomainHostnames();

  return json(domain);
}
