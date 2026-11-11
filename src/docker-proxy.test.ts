// Fork: the Docker image replaces src/proxy.ts with docker/proxy.ts (see Dockerfile). This
// guards the one call that keeps link domains working there, in case a merge drops it.
import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, expect, test, vi } from 'vitest';
import { linkDomainProxy } from '@/lib/link-domain-proxy';
import middleware from '../docker/proxy';

vi.mock('@/lib/link-domain-proxy', () => ({
  linkDomainProxy: vi.fn(),
}));

const linkDomainProxyMock = vi.mocked(linkDomainProxy);

const request = (path: string) => new NextRequest(`http://localhost:3000${path}`);

beforeEach(() => {
  linkDomainProxyMock.mockReset();
});

test('answers a link-domain request without running the rest of the proxy', async () => {
  linkDomainProxyMock.mockResolvedValue(new NextResponse(null, { status: 404 }));

  const response = await middleware(request('/login'));

  expect(response.status).toBe(404);
  expect(response.headers.get('Content-Security-Policy')).toBeNull();
});

test('handles every other request as before', async () => {
  linkDomainProxyMock.mockResolvedValue(undefined);

  const response = await middleware(request('/login'));

  expect(response.headers.get('x-middleware-next')).toBe('1');
  expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
});
