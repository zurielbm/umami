import { beforeEach, expect, test, vi } from 'vitest';
import { clearLinkDomainHostnames } from '@/lib/link-domain-hosts';
import { parseRequest } from '@/lib/request';
import { canViewTeam } from '@/permissions';
import { canCreateLinkDomain } from '@/permissions/link-domain';
import {
  createLinkDomain,
  getLinkDomainByHostname,
  getTeamLinkDomains,
  getUserLinkDomains,
} from '@/queries/prisma/linkDomain';
import { GET, POST } from './route';

vi.mock('@/lib/request', () => ({ parseRequest: vi.fn() }));
vi.mock('@/lib/link-domain-hosts', () => ({ clearLinkDomainHostnames: vi.fn() }));
vi.mock('@/permissions', () => ({ canViewTeam: vi.fn() }));
vi.mock('@/permissions/link-domain', () => ({ canCreateLinkDomain: vi.fn() }));
vi.mock('@/queries/prisma/linkDomain', () => ({
  createLinkDomain: vi.fn(),
  getLinkDomainByHostname: vi.fn(),
  getTeamLinkDomains: vi.fn(),
  getUserLinkDomains: vi.fn(),
}));

const parseRequestMock = vi.mocked(parseRequest);
const canViewTeamMock = vi.mocked(canViewTeam);
const canCreateMock = vi.mocked(canCreateLinkDomain);
const createMock = vi.mocked(createLinkDomain);
const byHostnameMock = vi.mocked(getLinkDomainByHostname);
const teamDomainsMock = vi.mocked(getTeamLinkDomains);
const userDomainsMock = vi.mocked(getUserLinkDomains);
const clearMock = vi.mocked(clearLinkDomainHostnames);

const auth = { user: { id: 'user-1' } };
const teamId = '11111111-1111-4111-8111-111111111111';

function post(body: Record<string, unknown>, host = 'analytics.example.com') {
  parseRequestMock.mockResolvedValue({ auth, body, error: undefined } as any);

  return POST(
    new Request('http://localhost/api/link-domains', { method: 'POST', headers: { host } }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  canCreateMock.mockResolvedValue(true);
  byHostnameMock.mockResolvedValue(null);
  createMock.mockImplementation(async data => ({ ...data, createdAt: new Date() }) as any);
});

test('GET lists the signed-in user’s domains', async () => {
  parseRequestMock.mockResolvedValue({ auth, query: {}, error: undefined } as any);
  userDomainsMock.mockResolvedValue([{ id: 'd1', hostname: 'go.brand.com' }] as any);

  const response = await GET(new Request('http://localhost/api/link-domains'));

  expect(await response.json()).toEqual([{ id: 'd1', hostname: 'go.brand.com' }]);
  expect(userDomainsMock).toHaveBeenCalledWith('user-1');
});

test('GET lists a team’s domains only for people who can view the team', async () => {
  parseRequestMock.mockResolvedValue({ auth, query: { teamId }, error: undefined } as any);
  canViewTeamMock.mockResolvedValue(false);

  const denied = await GET(new Request('http://localhost/api/link-domains'));

  expect(denied.status).toBe(401);
  expect(teamDomainsMock).not.toHaveBeenCalled();

  canViewTeamMock.mockResolvedValue(true);
  teamDomainsMock.mockResolvedValue([]);

  expect((await GET(new Request('http://localhost/api/link-domains'))).status).toBe(200);
  expect(teamDomainsMock).toHaveBeenCalledWith(teamId);
});

test('POST stores the cleaned-up hostname for the user and refreshes the proxy cache', async () => {
  const response = await post({ hostname: ' https://Go.Brand.com/ ' });

  expect(response.status).toBe(200);
  expect(createMock).toHaveBeenCalledWith({
    id: expect.any(String),
    hostname: 'go.brand.com',
    userId: 'user-1',
  });
  expect(clearMock).toHaveBeenCalled();
});

test('POST stores a team domain under the team, not the user', async () => {
  await post({ hostname: 'go.brand.com', teamId });

  expect(canCreateMock).toHaveBeenCalledWith(auth, teamId);
  expect(createMock).toHaveBeenCalledWith({
    id: expect.any(String),
    hostname: 'go.brand.com',
    teamId,
  });
});

test('POST refuses people who may not create links', async () => {
  canCreateMock.mockResolvedValue(false);

  expect((await post({ hostname: 'go.brand.com' })).status).toBe(401);
  expect(createMock).not.toHaveBeenCalled();
});

test.each(['localhost', '10.0.0.1', 'not a domain'])('POST rejects %s', async hostname => {
  expect((await post({ hostname })).status).toBe(400);
  expect(createMock).not.toHaveBeenCalled();
});

test('POST refuses the address this instance is served from', async () => {
  const response = await post({ hostname: 'analytics.example.com' }, 'analytics.example.com');

  expect(response.status).toBe(400);
  expect(createMock).not.toHaveBeenCalled();
});

test('POST refuses a domain that is already added', async () => {
  byHostnameMock.mockResolvedValue({ id: 'd1', hostname: 'go.brand.com' } as any);

  expect((await post({ hostname: 'go.brand.com' })).status).toBe(400);
  expect(createMock).not.toHaveBeenCalled();
});
