// Fork: asks a branded domain to prove that it reaches this instance over HTTPS.
import { hash, secret } from '@/lib/crypto';
import { LINK_DOMAIN_CHECK_PATH } from '@/lib/link-domain';

export type LinkDomainCheck =
  | { connected: true }
  | { connected: false; reason: 'unreachable' | 'other-server' };

export function getLinkDomainToken(hostname: string) {
  return hash('link-domain', hostname, secret());
}

/**
 * Fetches the proof path on the domain and compares the token. The response body is never
 * returned to the caller, only this verdict, so the request cannot be used to read other hosts.
 */
export async function checkLinkDomain(hostname: string): Promise<LinkDomainCheck> {
  let response: Response;

  try {
    response = await fetch(`https://${hostname}${LINK_DOMAIN_CHECK_PATH}`, {
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // No DNS record, nothing listening, or no valid certificate for the name.
    return { connected: false, reason: 'unreachable' };
  }

  try {
    const { token } = await response.json();

    if (response.ok && token === getLinkDomainToken(hostname)) {
      return { connected: true };
    }
  } catch {
    // Not our JSON: something else answers on this name.
  }

  return { connected: false, reason: 'other-server' };
}
