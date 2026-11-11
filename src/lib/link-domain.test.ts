import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  getDefaultLinkHostname,
  getLinkDomainUrl,
  getRequestHostname,
  getReservedHostnames,
  getSlugFromPath,
  normalizeHostname,
} from './link-domain';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('normalizeHostname', () => {
  test('accepts a bare hostname and lowercases it', () => {
    expect(normalizeHostname('Go.Brand.com')).toBe('go.brand.com');
  });

  test('strips what people paste around it', () => {
    expect(normalizeHostname(' https://go.brand.com/ ')).toBe('go.brand.com');
    expect(normalizeHostname('http://go.brand.com:8080/path?x=1#y')).toBe('go.brand.com');
    expect(normalizeHostname('go.brand.com.')).toBe('go.brand.com');
  });

  test.each([
    ['', 'empty'],
    ['localhost', 'a single label'],
    ['10.0.0.1', 'an IPv4 address'],
    ['[::1]', 'an IPv6 address'],
    ['go..brand.com', 'an empty label'],
    ['-go.brand.com', 'a label starting with a hyphen'],
    ['go_links.brand.com', 'an underscore'],
    ['go brand.com', 'a space'],
    ['*.brand.com', 'a wildcard'],
    [`${'a'.repeat(64)}.com`, 'a label over 63 characters'],
    [`${'a.'.repeat(130)}com`, 'a name over 253 characters'],
  ])('rejects %s (%s)', value => {
    expect(normalizeHostname(value)).toBeNull();
  });

  test('rejects values that are not strings', () => {
    expect(normalizeHostname(undefined)).toBeNull();
    expect(normalizeHostname(null)).toBeNull();
  });
});

describe('getRequestHostname', () => {
  const headers = (values: Record<string, string>) => new Headers(values);

  test('reads the Host header without its port', () => {
    expect(getRequestHostname(headers({ host: 'Go.Brand.com:443' }))).toBe('go.brand.com');
  });

  test('prefers the forwarded host set by a reverse proxy', () => {
    expect(
      getRequestHostname(headers({ host: 'umami:3000', 'x-forwarded-host': 'go.brand.com' })),
    ).toBe('go.brand.com');
  });

  test('uses the first value when proxies chain several', () => {
    expect(getRequestHostname(headers({ 'x-forwarded-host': 'go.brand.com, cdn.example' }))).toBe(
      'go.brand.com',
    );
  });

  test('keeps an IPv6 literal intact', () => {
    expect(getRequestHostname(headers({ host: '[::1]:3000' }))).toBe('[::1]');
  });

  test('is null without a host', () => {
    expect(getRequestHostname(headers({}))).toBeNull();
    expect(getRequestHostname(undefined)).toBeNull();
  });
});

describe('getDefaultLinkHostname', () => {
  test('is the host of a LINKS_URL that has no path', () => {
    expect(getDefaultLinkHostname('https://go.example.com')).toBe('go.example.com');
    expect(getDefaultLinkHostname('https://GO.example.com/')).toBe('go.example.com');
  });

  test('is null when links live under a path, so the app host is never taken over', () => {
    expect(getDefaultLinkHostname('https://analytics.example.com/q')).toBeNull();
  });

  test('is null when LINKS_URL is unset or not a URL', () => {
    expect(getDefaultLinkHostname(undefined)).toBeNull();
    expect(getDefaultLinkHostname('not a url')).toBeNull();
  });
});

describe('getReservedHostnames', () => {
  test('lists the request host and the configured link and pixel hosts', () => {
    vi.stubEnv('LINKS_URL', 'https://go.example.com');
    vi.stubEnv('PIXELS_URL', 'https://px.example.com/p');

    expect(getReservedHostnames(new Headers({ host: 'analytics.example.com' }))).toEqual([
      'analytics.example.com',
      'go.example.com',
      'px.example.com',
    ]);
  });
});

describe('getSlugFromPath', () => {
  test('returns the only path segment', () => {
    expect(getSlugFromPath('/spring-promo')).toBe('spring-promo');
    expect(getSlugFromPath('/spring-promo/')).toBe('spring-promo');
    expect(getSlugFromPath('/caf%C3%A9-menu')).toBe('café-menu');
  });

  test.each(['/', '', '/a/b', '/q/spring-promo', '/%E0%A4%A'])('is null for %s', path => {
    expect(getSlugFromPath(path)).toBeNull();
  });
});

test('getLinkDomainUrl builds the public address', () => {
  expect(getLinkDomainUrl('go.brand.com', 'spring-promo')).toBe(
    'https://go.brand.com/spring-promo',
  );
});
