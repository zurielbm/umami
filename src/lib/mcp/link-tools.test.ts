import { UmamiClient } from '@umami/api-client';
import { describeError, silentLogger, type ToolContext } from '@umami/mcp';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createLinkFetch } from './link-dispatch';
import { getMcpTools, linkTools } from './link-tools';

vi.mock('./link-dispatch', () => ({ createLinkFetch: vi.fn() }));

const TEAM_ID = '1a2b3c4d-0000-4000-8000-000000000001';
const DOMAIN_ID = '1a2b3c4d-0000-4000-8000-000000000002';
const LINK_ID = '1a2b3c4d-0000-4000-8000-000000000003';

const link = {
  id: LINK_ID,
  name: 'Spring promo',
  url: 'https://example.com/sale',
  slug: 'spring-promo',
  teamId: TEAM_ID,
  domainId: DOMAIN_ID,
  createdAt: '2026-11-11T00:00:00.000Z',
};

type Call = { method: string; path: string; search: URLSearchParams; body: any };

let calls: Call[];
let respond: (call: Call) => { status?: number; body: unknown };

const defaults = (call: Call) => {
  if (call.path === '/api/link-domains') {
    return { body: [{ id: DOMAIN_ID, hostname: 'go.brand.com', teamId: TEAM_ID }] };
  }

  if (call.path === '/api/me/teams') {
    return { body: { data: [{ id: TEAM_ID, name: 'Acme', accessCode: 'x' }], count: 1 } };
  }

  if (call.path.endsWith('/links')) {
    return { body: { data: [link], count: 1, page: 1, pageSize: 20 } };
  }

  return { body: call.method === 'POST' ? { ...link, ...call.body } : link };
};

// The MCP package resolves its own copy of the API client, so the two types differ by name only.
const client = new UmamiClient({
  baseUrl: 'https://analytics.example.com/api',
  token: 'secret',
}) as unknown as ToolContext['client'];

/** Runs a tool the way the MCP server does: validate the input, then call the handler. */
async function call(name: string, args: Record<string, unknown> = {}) {
  const tool = linkTools.find(item => item.name === name);
  const input = tool.inputSchema.safeParse(args);

  if (!input.success) {
    return { isError: true, data: { error: { message: input.error.message } } as any };
  }

  try {
    return {
      isError: false,
      data: (await tool.handler(input.data, { client, logger: silentLogger })) as any,
    };
  } catch (error) {
    return { isError: true, data: { error: describeError(error) } as any };
  }
}

beforeEach(() => {
  calls = [];
  respond = defaults;
  vi.stubEnv('LINKS_URL', '');

  vi.mocked(createLinkFetch).mockReturnValue(async (input, init = {}) => {
    const url = new URL(input.toString());
    const entry = {
      method: init.method ?? 'GET',
      path: url.pathname,
      search: url.searchParams,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    };

    calls.push(entry);

    const { status = 200, body } = respond(entry);

    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test('adds the link tools to the analytics tools, and marks only the writers as writing', () => {
  const names = getMcpTools().map(tool => tool.name);

  expect(names).toContain('list_websites');
  expect(names).toEqual(expect.arrayContaining(linkTools.map(tool => tool.name)));
  expect(new Set(names).size).toBe(names.length);
  expect(names.filter(name => /delete|remove/.test(name))).toEqual([]);

  const writers = linkTools.filter(tool => tool.annotations?.readOnlyHint === false);

  expect(writers.map(tool => tool.name).sort()).toEqual(['create_link', 'update_link']);
  expect(linkTools.some(tool => tool.annotations?.destructiveHint)).toBe(false);
});

test('list_links shows the branded address and the team it belongs to', async () => {
  const { data } = await call('list_links', { teamId: TEAM_ID, search: 'spring' });

  expect(calls[0].path).toBe(`/api/teams/${TEAM_ID}/links`);
  expect(calls[0].search.get('search')).toBe('spring');
  expect(data.links[0]).toMatchObject({
    id: LINK_ID,
    address: 'https://go.brand.com/spring-promo',
    destination: 'https://example.com/sale',
    teamId: TEAM_ID,
    domain: 'go.brand.com',
  });
  expect(data.count).toBe(1);
});

test('a link without a domain gets the default address and needs no domain lookup', async () => {
  respond = entry =>
    entry.path === `/api/links/${LINK_ID}`
      ? { body: { ...link, teamId: null, domainId: null } }
      : defaults(entry);

  const { data } = await call('get_link', { linkId: LINK_ID });

  expect(data.link.address).toBe('https://analytics.example.com/q/spring-promo');
  expect(data.link.domain).toBeNull();
  expect(calls.map(entry => entry.path)).toEqual([`/api/links/${LINK_ID}`]);
});

test('create_link sends the owner and domain, and makes up a slug when none is given', async () => {
  await call('create_link', {
    name: 'Spring promo',
    url: 'https://example.com/sale',
    slug: 'spring-promo',
    teamId: TEAM_ID,
    domainId: DOMAIN_ID,
  });

  expect(calls[0]).toMatchObject({ method: 'POST', path: '/api/links' });
  expect(calls[0].body).toEqual({
    name: 'Spring promo',
    url: 'https://example.com/sale',
    slug: 'spring-promo',
    teamId: TEAM_ID,
    domainId: DOMAIN_ID,
  });

  calls = [];
  await call('create_link', { name: 'No slug', url: 'https://example.com/x' });

  expect(calls[0].body.slug).toMatch(/^[0-9A-Za-z]{9}$/);
  expect(calls[0].body).not.toHaveProperty('teamId');
});

test('create_link refuses a destination that is not a complete web address', async () => {
  for (const url of ['example.com/sale', 'javascript:alert(1)', 'ftp://example.com/file']) {
    const { isError } = await call('create_link', { name: 'Bad', url });

    expect(isError).toBe(true);
  }

  expect(calls).toHaveLength(0);
});

test('create_link explains a taken slug instead of reporting a server error', async () => {
  respond = entry =>
    entry.method === 'POST' ? { status: 500, body: { error: { message: 'x' } } } : defaults(entry);

  const { isError, data } = await call('create_link', {
    name: 'Dup',
    url: 'https://example.com/x',
    slug: 'spring-promo',
  });

  expect(isError).toBe(true);
  expect(data.error.message).toContain('already taken');
});

test('update_link sends only what changes and cannot change the slug', async () => {
  await call('update_link', { linkId: LINK_ID, url: 'https://example.com/new', domainId: null });

  expect(calls[0]).toMatchObject({ method: 'POST', path: `/api/links/${LINK_ID}` });
  expect(calls[0].body).toEqual({ url: 'https://example.com/new', domainId: null });

  calls = [];
  await call('update_link', { linkId: LINK_ID, name: 'Renamed', slug: 'other-slug' });

  expect(calls[0].body).toEqual({ name: 'Renamed' });

  calls = [];
  const { isError } = await call('update_link', { linkId: LINK_ID });

  expect(isError).toBe(true);
  expect(calls).toHaveLength(0);
});

test('get_link_qr returns an SVG of the branded address with a file name', async () => {
  const { data } = await call('get_link_qr', { linkId: LINK_ID });

  expect(data).toMatchObject({
    address: 'https://go.brand.com/spring-promo',
    encoded: 'https://go.brand.com/spring-promo',
    format: 'svg',
    fileName: 'spring-promo-qr.svg',
  });
  expect(data.svg).toMatch(/^<svg /);
});

test('get_link_qr can mark scans and return a PNG', async () => {
  const { data } = await call('get_link_qr', {
    linkId: LINK_ID,
    format: 'png',
    size: 256,
    utmSource: 'qr',
  });

  expect(data.encoded).toBe('https://go.brand.com/spring-promo?utm_source=qr');
  expect(data.address).toBe('https://go.brand.com/spring-promo');
  expect(data.fileName).toBe('spring-promo-qr.png');
  expect(Buffer.from(data.pngBase64, 'base64').subarray(1, 4).toString()).toBe('PNG');
});

test('list_teams and list_link_domains return ids an agent can pass on', async () => {
  expect((await call('list_teams')).data).toEqual({ teams: [{ id: TEAM_ID, name: 'Acme' }] });

  const { data } = await call('list_link_domains', { teamId: TEAM_ID });

  expect(calls.at(-1)?.search.get('teamId')).toBe(TEAM_ID);
  expect(data.domains).toEqual([{ id: DOMAIN_ID, hostname: 'go.brand.com', teamId: TEAM_ID }]);
});
