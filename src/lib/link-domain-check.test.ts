import { afterEach, expect, test, vi } from 'vitest';
import { checkLinkDomain, getLinkDomainToken } from './link-domain-check';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(impl: (...args: any[]) => Promise<Response>) {
  const fetchMock = vi.fn(impl);

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

test('is connected when the domain returns the token for its own hostname', async () => {
  const fetchMock = stubFetch(async () =>
    Response.json({ token: getLinkDomainToken('go.brand.com') }),
  );

  expect(await checkLinkDomain('go.brand.com')).toEqual({ connected: true });
  expect(fetchMock.mock.calls[0][0]).toBe('https://go.brand.com/.well-known/umami-link-domain');
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
});

test('the token is specific to the hostname', () => {
  expect(getLinkDomainToken('go.brand.com')).not.toBe(getLinkDomainToken('go.other.com'));
});

test('reports another server when the token does not match', async () => {
  stubFetch(async () => Response.json({ token: getLinkDomainToken('go.other.com') }));

  expect(await checkLinkDomain('go.brand.com')).toEqual({
    connected: false,
    reason: 'other-server',
  });
});

test('reports another server when the answer is not our JSON', async () => {
  stubFetch(async () => new Response('<html>parked</html>', { status: 200 }));

  expect(await checkLinkDomain('go.brand.com')).toEqual({
    connected: false,
    reason: 'other-server',
  });
});

test('reports unreachable when the request fails (no DNS, no certificate, timeout)', async () => {
  stubFetch(async () => {
    throw new TypeError('fetch failed');
  });

  expect(await checkLinkDomain('go.brand.com')).toEqual({
    connected: false,
    reason: 'unreachable',
  });
});
