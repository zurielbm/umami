import { expect, test } from 'vitest';
import { createLinkFetch, MCP_LINK_ROUTES, matchLinkRoute } from './link-dispatch';

const LINK_ID = '6f2a7e0e-2b0f-4b3f-9f0a-1234567890ab';

test('matches the link routes and extracts their parameters', () => {
  expect(matchLinkRoute('GET', '/api/links')?.route.path).toBe('/api/links');
  expect(matchLinkRoute('post', `/api/links/${LINK_ID}`)?.params).toEqual({ linkId: LINK_ID });
  expect(matchLinkRoute('GET', '/base/api/teams/t1/links/')?.params).toEqual({ teamId: 't1' });
});

test('offers nothing that deletes', () => {
  expect(MCP_LINK_ROUTES.map(({ method }) => method)).not.toContain('DELETE');
  expect(matchLinkRoute('DELETE', `/api/links/${LINK_ID}`)).toBeNull();
  expect(matchLinkRoute('DELETE', '/api/link-domains/d1')).toBeNull();
});

test('does not reach routes outside the table', () => {
  expect(matchLinkRoute('POST', '/api/link-domains')).toBeNull();
  expect(matchLinkRoute('GET', '/api/users')).toBeNull();
  expect(matchLinkRoute('GET', '/api/me/api-keys')).toBeNull();
  expect(matchLinkRoute('GET', `/api/links/${LINK_ID}/extra`)).toBeNull();
});

test('answers 404 for a route that is not available', async () => {
  const response = await createLinkFetch()('https://example.com/api/users', { method: 'GET' });

  expect(response.status).toBe(404);
});
