// Fork: queries for branded link domains.
import prisma from '@/lib/prisma';

const select = {
  id: true,
  hostname: true,
  userId: true,
  teamId: true,
  createdAt: true,
};

export async function createLinkDomain(data: {
  id: string;
  hostname: string;
  userId?: string;
  teamId?: string;
}) {
  return prisma.client.linkDomain.create({ data, select });
}

export async function getLinkDomain(id: string) {
  return prisma.client.linkDomain.findUnique({ where: { id }, select });
}

export async function getLinkDomainByHostname(hostname: string) {
  return prisma.client.linkDomain.findUnique({ where: { hostname }, select });
}

export async function getUserLinkDomains(userId: string) {
  return prisma.client.linkDomain.findMany({
    where: { userId },
    select,
    orderBy: { hostname: 'asc' },
  });
}

export async function getTeamLinkDomains(teamId: string) {
  return prisma.client.linkDomain.findMany({
    where: { teamId },
    select,
    orderBy: { hostname: 'asc' },
  });
}

export async function getLinkDomainHostnames() {
  const rows = await prisma.client.linkDomain.findMany({ select: { hostname: true } });

  return rows.map(row => row.hostname);
}

export async function deleteLinkDomain(id: string) {
  return prisma.client.linkDomain.delete({ where: { id }, select });
}

/** The link a branded domain serves at /<slug>. Links of other domains never match. */
export async function findLinkByDomain(hostname: string, slug: string) {
  return prisma.client.link.findFirst({
    where: { slug, deletedAt: null, domain: { hostname } },
  });
}

export async function linkSlugExists(slug: string) {
  const link = await prisma.client.link.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true },
  });

  return !!link;
}
