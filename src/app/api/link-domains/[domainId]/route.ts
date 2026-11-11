// Fork: remove a branded link domain. Its links keep working at their default address.
import { clearLinkDomainHostnames } from '@/lib/link-domain-hosts';
import { parseRequest } from '@/lib/request';
import { ok, unauthorized } from '@/lib/response';
import { canDeleteLinkDomain } from '@/permissions/link-domain';
import { deleteLinkDomain } from '@/queries/prisma/linkDomain';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> },
) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const { domainId } = await params;

  if (!(await canDeleteLinkDomain(auth, domainId))) {
    return unauthorized();
  }

  await deleteLinkDomain(domainId);

  clearLinkDomainHostnames();

  return ok();
}
