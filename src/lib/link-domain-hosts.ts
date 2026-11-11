// Fork: the set of registered link-domain hostnames, cached in memory so the request proxy
// does not query the database on every request.
import { getLinkDomainHostnames } from '@/queries/prisma/linkDomain';

const TTL = 60 * 1000;
const KEY = Symbol.for('umami.linkDomainHosts');

type HostCache = {
  hosts: Set<string>;
  expires: number;
  loaded: boolean;
  pending?: Promise<Set<string>>;
};

// The proxy and the API routes are bundled separately but run in one process; a global
// lets a change made through the API reach the proxy without waiting for the TTL.
function getCache(): HostCache {
  const store = globalThis as unknown as Record<symbol, HostCache | undefined>;

  store[KEY] ??= { hosts: new Set(), expires: 0, loaded: false };

  return store[KEY];
}

async function load(cache: HostCache) {
  try {
    cache.hosts = new Set(await getLinkDomainHostnames());
  } catch {
    // Keep the previous set: a database hiccup must not take link domains (or the app) down.
  }

  cache.expires = Date.now() + TTL;
  cache.loaded = true;
  cache.pending = undefined;

  return cache.hosts;
}

export async function isLinkDomainHostname(hostname: string) {
  const cache = getCache();

  if (Date.now() >= cache.expires) {
    cache.pending ??= load(cache);

    // Wait only for the first load and after a change. A routine refresh runs in the
    // background and this request is answered from the previous set, so a slow database
    // never delays requests that have nothing to do with link domains.
    if (!cache.loaded) {
      return (await cache.pending).has(hostname);
    }
  }

  return cache.hosts.has(hostname);
}

/** Call after adding or removing a domain: the next request waits for a fresh list. */
export function clearLinkDomainHostnames() {
  const cache = getCache();

  cache.expires = 0;
  cache.loaded = false;
}
