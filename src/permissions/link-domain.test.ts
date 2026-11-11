import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getLinkDomain, getTeamUser } from '@/queries/prisma';
import { canDeleteLinkDomain, isLinkDomainOwnedBy } from './link-domain';

vi.mock('@/queries/prisma', () => ({ getLinkDomain: vi.fn(), getTeamUser: vi.fn() }));
vi.mock('./team', () => ({ canCreateTeamWebsite: vi.fn() }));
vi.mock('./website', () => ({ canCreateWebsite: vi.fn() }));
vi.mock('@/lib/auth', async () => {
  const { ROLE_PERMISSIONS } = await import('@/lib/constants');

  return {
    hasPermission: (role: string, permission: string | string[]) =>
      (Array.isArray(permission) ? permission : [permission]).some(p =>
        ROLE_PERMISSIONS[role]?.includes(p),
      ),
  };
});

const getLinkDomainMock = vi.mocked(getLinkDomain);
const getTeamUserMock = vi.mocked(getTeamUser);

const userDomain = { id: 'd1', hostname: 'go.brand.com', userId: 'user-1', teamId: null };
const teamDomain = { id: 'd2', hostname: 'go.team.com', userId: null, teamId: 'team-1' };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('isLinkDomainOwnedBy', () => {
  test('a user’s link may use that user’s domain', async () => {
    getLinkDomainMock.mockResolvedValue(userDomain as any);

    expect(await isLinkDomainOwnedBy('d1', { userId: 'user-1' })).toBe(true);
  });

  test('another user’s link may not', async () => {
    getLinkDomainMock.mockResolvedValue(userDomain as any);

    expect(await isLinkDomainOwnedBy('d1', { userId: 'user-2' })).toBe(false);
  });

  test('a team link may use the team’s domain but not a member’s personal one', async () => {
    getLinkDomainMock.mockResolvedValue(teamDomain as any);
    expect(await isLinkDomainOwnedBy('d2', { teamId: 'team-1' })).toBe(true);
    expect(await isLinkDomainOwnedBy('d2', { teamId: 'team-2' })).toBe(false);

    getLinkDomainMock.mockResolvedValue(userDomain as any);
    expect(await isLinkDomainOwnedBy('d1', { userId: 'user-1', teamId: 'team-1' })).toBe(false);
  });

  test('a personal link may not use a team domain', async () => {
    getLinkDomainMock.mockResolvedValue(teamDomain as any);

    expect(await isLinkDomainOwnedBy('d2', { userId: 'user-1', teamId: null })).toBe(false);
  });

  test('an unknown domain is never usable', async () => {
    getLinkDomainMock.mockResolvedValue(null);

    expect(await isLinkDomainOwnedBy('nope', { userId: 'user-1' })).toBe(false);
  });
});

describe('canDeleteLinkDomain', () => {
  const auth = (user: any) => ({ user }) as any;

  test('the owner and an admin may delete; a stranger may not', async () => {
    getLinkDomainMock.mockResolvedValue(userDomain as any);

    expect(await canDeleteLinkDomain(auth({ id: 'user-1' }), 'd1')).toBe(true);
    expect(await canDeleteLinkDomain(auth({ id: 'admin', isAdmin: true }), 'd1')).toBe(true);
    expect(await canDeleteLinkDomain(auth({ id: 'user-2' }), 'd1')).toBe(false);
    expect(await canDeleteLinkDomain(auth(undefined), 'd1')).toBe(false);
  });

  test('a team domain needs a team role that may delete', async () => {
    getLinkDomainMock.mockResolvedValue(teamDomain as any);

    getTeamUserMock.mockResolvedValue({ role: 'team-owner' } as any);
    expect(await canDeleteLinkDomain(auth({ id: 'user-1' }), 'd2')).toBe(true);

    getTeamUserMock.mockResolvedValue({ role: 'team-view-only' } as any);
    expect(await canDeleteLinkDomain(auth({ id: 'user-1' }), 'd2')).toBe(false);

    getTeamUserMock.mockResolvedValue(null);
    expect(await canDeleteLinkDomain(auth({ id: 'user-1' }), 'd2')).toBe(false);
  });

  test('a domain that does not exist cannot be deleted, even by an admin', async () => {
    getLinkDomainMock.mockResolvedValue(null);

    expect(await canDeleteLinkDomain(auth({ id: 'admin', isAdmin: true }), 'nope')).toBe(false);
  });
});
