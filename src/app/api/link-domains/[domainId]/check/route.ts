// Fork: report whether a branded link domain currently reaches this instance.
import { checkLinkDomain } from '@/lib/link-domain-check';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { canDeleteLinkDomain } from '@/permissions/link-domain';
import { getLinkDomain } from '@/queries/prisma/linkDomain';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> },
) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const { domainId } = await params;

  // Same people who may remove a domain may probe it.
  if (!(await canDeleteLinkDomain(auth, domainId))) {
    return unauthorized();
  }

  const domain = await getLinkDomain(domainId);

  return json(await checkLinkDomain(domain.hostname));
}
