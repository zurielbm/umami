import { NextRequest } from 'next/server';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getLinkDomainToken } from '@/lib/link-domain-check';
import { isLinkDomainHostname } from '@/lib/link-domain-hosts';
import { linkSlugExists } from '@/queries/prisma/linkDomain';
import { proxy } from './proxy';

vi.mock('@/lib/link-domain-hosts', () => ({
  isLinkDomainHostname: vi.fn(),
}));

vi.mock('@/queries/prisma/linkDomain', () => ({
  linkSlugExists: vi.fn(),
}));

const isLinkDomainHostnameMock = vi.mocked(isLinkDomainHostname);
const linkSlugExistsMock = vi.mocked(linkSlugExists);

function request(host: string, path: string) {
  return new NextRequest(`http://localhost:3000${path}`, { headers: { host } });
}

const passedThrough = (response: Response) => response.headers.get('x-middleware-next') === '1';
const rewrittenTo = (response: Response) => {
  const value = response.headers.get('x-middleware-rewrite');

  return value ? new URL(value).pathname + new URL(value).search : null;
};

beforeEach(() => {
  isLinkDomainHostnameMock.mockReset();
  linkSlugExistsMock.mockReset();
  isLinkDomainHostnameMock.mockImplementation(async hostname => hostname === 'go.brand.com');
  linkSlugExistsMock.mockResolvedValue(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test('leaves requests for the app itself alone', async () => {
  expect(passedThrough(await proxy(request('analytics.example.com', '/login')))).toBe(true);
  expect(passedThrough(await proxy(request('analytics.example.com', '/spring-promo')))).toBe(true);
  expect(linkSlugExistsMock).not.toHaveBeenCalled();
});

test('sends /<slug> on a branded domain to the branded redirect, keeping the query', async () => {
  const response = await proxy(request('go.brand.com', '/spring-promo?utm_source=flyer'));

  expect(rewrittenTo(response)).toBe('/ld/go.brand.com/spring-promo?utm_source=flyer');
});

test('matches the branded host whatever its case or port', async () => {
  expect(rewrittenTo(await proxy(request('GO.Brand.com:443', '/spring-promo')))).toBe(
    '/ld/go.brand.com/spring-promo',
  );
});

test.each(['/', '/websites/abc', '/q/spring-promo', '/ld/other.com/spring-promo'])(
  'answers 404 for %s on a branded domain so the app is not exposed there',
  async path => {
    const response = await proxy(request('go.brand.com', path));

    expect(response.status).toBe(404);
    expect(passedThrough(response)).toBe(false);
  },
);

test('treats an app page name on a branded domain as a slug, never as the app page', async () => {
  expect(rewrittenTo(await proxy(request('go.brand.com', '/login')))).toBe(
    '/ld/go.brand.com/login',
  );
});

test('lets its own rewritten path through on a branded domain', async () => {
  expect(passedThrough(await proxy(request('go.brand.com', '/ld/go.brand.com/spring-promo')))).toBe(
    true,
  );
});

test('answers the proof path with the token for that hostname', async () => {
  const response = await proxy(request('go.brand.com', '/.well-known/umami-link-domain'));

  expect(await response.json()).toEqual({ token: getLinkDomainToken('go.brand.com') });
});

test('does not answer the proof path on other hosts', async () => {
  expect(
    passedThrough(await proxy(request('analytics.example.com', '/.well-known/umami-link-domain'))),
  ).toBe(true);
});

test('on the short link host, /<slug> of an existing link goes to the standard redirect', async () => {
  vi.stubEnv('LINKS_URL', 'https://go.example.com');
  linkSlugExistsMock.mockResolvedValue(true);

  expect(rewrittenTo(await proxy(request('go.example.com', '/spring-promo')))).toBe(
    '/q/spring-promo',
  );
  expect(linkSlugExistsMock).toHaveBeenCalledWith('spring-promo');
});

test('on the short link host, anything that is not a link still reaches the app', async () => {
  vi.stubEnv('LINKS_URL', 'https://go.example.com');

  expect(passedThrough(await proxy(request('go.example.com', '/login')))).toBe(true);
  expect(passedThrough(await proxy(request('go.example.com', '/websites/abc')))).toBe(true);
});

test('a LINKS_URL with a path never turns its host into a short link host', async () => {
  vi.stubEnv('LINKS_URL', 'https://analytics.example.com/q');
  linkSlugExistsMock.mockResolvedValue(true);

  expect(passedThrough(await proxy(request('analytics.example.com', '/spring-promo')))).toBe(true);
});

test('passes the request through when the lookup fails', async () => {
  isLinkDomainHostnameMock.mockRejectedValue(new Error('database down'));

  expect(passedThrough(await proxy(request('go.brand.com', '/spring-promo')))).toBe(true);
});
