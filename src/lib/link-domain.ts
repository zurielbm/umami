// Fork: helpers for branded link domains. Pure functions only (no database access), so the
// request proxy, API routes and browser code can all import this file.

type HeaderStore = Pick<Headers, 'get'>;

/** Path a link domain answers with a proof that it reaches this instance. */
export const LINK_DOMAIN_CHECK_PATH = '/.well-known/umami-link-domain';

const HOSTNAME_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Turns what a person typed ("https://Go.Brand.com/", "go.brand.com.") into a bare hostname.
 * Returns null when the result is not a public DNS name with at least two labels.
 */
export function normalizeHostname(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const hostname = value
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');

  if (!hostname || hostname.length > 253) {
    return null;
  }

  const labels = hostname.split('.');

  if (labels.length < 2 || !labels.every(label => HOSTNAME_LABEL.test(label))) {
    return null;
  }

  // A numeric last label means an IP address, not a name.
  if (/^\d+$/.test(labels[labels.length - 1])) {
    return null;
  }

  return hostname;
}

/** Hostname the request was addressed to, lowercased and without a port. */
export function getRequestHostname(headers?: HeaderStore | null): string | null {
  const host = (headers?.get('x-forwarded-host') || headers?.get('host'))?.split(',')[0]?.trim();

  if (!host) {
    return null;
  }

  // "[::1]:3000" keeps its brackets; "example.com:3000" loses its port.
  const hostname = host.startsWith('[') ? host.replace(/\]:\d+$/, ']') : host.replace(/:\d+$/, '');

  return hostname.toLowerCase().replace(/\.$/, '') || null;
}

function getUrlHostname(value: string | undefined, bareOriginOnly = false): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (bareOriginOnly && url.pathname !== '/') {
      return null;
    }

    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * When LINKS_URL is a bare origin ("https://go.example.com"), that host serves every link at
 * /<slug>. With a path ("https://example.com/q") links stay under that path and this is null.
 */
export function getDefaultLinkHostname(linksUrl = process.env.LINKS_URL): string | null {
  return getUrlHostname(linksUrl, true);
}

/** Hostnames this instance already uses for itself, which must not be claimed as link domains. */
export function getReservedHostnames(headers?: HeaderStore | null): string[] {
  return [
    getRequestHostname(headers),
    getUrlHostname(process.env.LINKS_URL),
    getUrlHostname(process.env.PIXELS_URL),
  ].filter((hostname): hostname is string => !!hostname);
}

/** The slug when the path is exactly "/<slug>", otherwise null. */
export function getSlugFromPath(pathname: string): string | null {
  const match = /^\/([^/]+)\/?$/.exec(pathname);

  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/** Public address of a link on a branded domain. */
export function getLinkDomainUrl(hostname: string, slug: string): string {
  return `https://${hostname}/${slug}`;
}
