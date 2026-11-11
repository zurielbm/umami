// Fork: the API routes the MCP link tools may call, dispatched in-process like the team's
// table in dispatch.ts. They are kept in a separate table so that file stays untouched.
// Nothing here can delete: removing a link or a domain is left to a person.
import { badRequest, notFound, serverError } from '@/lib/response';
import type { DispatchRoute, InProcessFetch } from './dispatch';

export const MCP_LINK_ROUTES: readonly DispatchRoute[] = [
  { method: 'GET', path: '/api/links', load: () => import('@/app/api/links/route') },
  { method: 'POST', path: '/api/links', load: () => import('@/app/api/links/route') },
  {
    method: 'GET',
    path: '/api/links/{linkId}',
    load: () => import('@/app/api/links/[linkId]/route'),
  },
  {
    method: 'POST',
    path: '/api/links/{linkId}',
    load: () => import('@/app/api/links/[linkId]/route'),
  },
  {
    method: 'GET',
    path: '/api/teams/{teamId}/links',
    load: () => import('@/app/api/teams/[teamId]/links/route'),
  },
  { method: 'GET', path: '/api/link-domains', load: () => import('@/app/api/link-domains/route') },
  { method: 'GET', path: '/api/me/teams', load: () => import('@/app/api/me/teams/route') },
];

export function matchLinkRoute(method: string, pathname: string) {
  const apiIndex = pathname.indexOf('/api/');
  const segments = (apiIndex >= 0 ? pathname.slice(apiIndex) : pathname)
    .replace(/\/+$/, '')
    .split('/');

  for (const route of MCP_LINK_ROUTES) {
    const pattern = route.path.split('/');

    if (route.method !== method.toUpperCase() || pattern.length !== segments.length) {
      continue;
    }

    const params: Record<string, string> = {};
    const matches = pattern.every((part, index) => {
      const name = /^\{([^}]+)}$/.exec(part)?.[1];

      if (!name) {
        return part === segments[index];
      }

      try {
        params[name] = decodeURIComponent(segments[index]);
      } catch {
        return false;
      }

      return segments[index] !== '';
    });

    if (matches) {
      return { route, params };
    }
  }

  return null;
}

/** A `fetch` for the link tools: the same request parsing and permission checks as HTTP. */
export function createLinkFetch(): InProcessFetch {
  return async (input, init = {}) => {
    const url = new URL(input.toString());
    const method = (init.method ?? 'GET').toUpperCase();
    const matched = matchLinkRoute(method, url.pathname);

    if (!matched) {
      return notFound({ message: `Route ${method} ${url.pathname} is not available to MCP.` });
    }

    try {
      const module = await matched.route.load();
      const handler = module[method as 'GET' | 'POST'];

      if (!handler) {
        return badRequest({ message: `Method ${method} is not supported.` });
      }

      const request = new Request(url, {
        method,
        headers: init.headers,
        body: init.body ?? undefined,
        signal: init.signal ?? undefined,
      });

      return await handler(request, { params: Promise.resolve(matched.params) });
    } catch (error) {
      return serverError(error);
    }
  };
}
