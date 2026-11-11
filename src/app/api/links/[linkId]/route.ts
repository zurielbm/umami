import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { badRequest, json, ok, serverError, unauthorized } from '@/lib/response';
import { canDeleteLink, canUpdateLink, canViewLink, isLinkDomainOwnedBy } from '@/permissions';
import { deleteLink, getLink, updateLink } from '@/queries/prisma';

export async function GET(request: Request, { params }: { params: Promise<{ linkId: string }> }) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const { linkId } = await params;

  if (!(await canViewLink(auth, linkId))) {
    return unauthorized();
  }

  const website = await getLink(linkId);

  return json(website);
}

export async function POST(request: Request, { params }: { params: Promise<{ linkId: string }> }) {
  const schema = z.object({
    name: z.string().max(100).optional(),
    url: z.string().max(500).optional(),
    slug: z.string().min(8).max(100).optional(),
    domainId: z.uuid().nullable().optional(),
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { linkId } = await params;
  const { name, url, slug } = body;

  if (!(await canUpdateLink(auth, linkId))) {
    return unauthorized();
  }

  // Fork: optional branded domain (null clears it), owned by the same user or team as the link.
  const { domainId } = body;

  if (domainId) {
    const link = await getLink(linkId);

    if (!(await isLinkDomainOwnedBy(domainId, link))) {
      return badRequest({ message: 'That domain cannot be used for this link.' });
    }
  }

  try {
    const result = await updateLink(linkId, { name, url, slug, domainId });

    return Response.json(result);
  } catch (e: any) {
    if (e.message.toLowerCase().includes('unique constraint') && e.message.includes('slug')) {
      return badRequest({ message: 'That slug is already taken.' });
    }

    return serverError(e);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ linkId: string }> },
) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const { linkId } = await params;

  if (!(await canDeleteLink(auth, linkId))) {
    return unauthorized();
  }

  await deleteLink(linkId);

  return ok();
}
