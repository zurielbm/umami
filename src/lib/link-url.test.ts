import { afterEach, expect, test, vi } from 'vitest';
import { getLinkAddress } from './link-url';

const origin = 'https://analytics.example.com';
const domains = [{ id: 'd1', hostname: 'go.brand.com' }];

afterEach(() => {
  vi.unstubAllEnvs();
});

test('uses /q on the instance when nothing else is set', () => {
  vi.stubEnv('LINKS_URL', '');

  expect(getLinkAddress({ slug: 'spring-promo' }, { origin })).toBe(
    'https://analytics.example.com/q/spring-promo',
  );
});

test('uses LINKS_URL when it is set', () => {
  vi.stubEnv('LINKS_URL', 'https://go.example.com/');

  expect(getLinkAddress({ slug: 'spring-promo' }, { origin })).toBe(
    'https://go.example.com/spring-promo',
  );
});

test('uses the branded domain of a link that has one', () => {
  vi.stubEnv('LINKS_URL', 'https://go.example.com');

  expect(getLinkAddress({ slug: 'spring-promo', domainId: 'd1' }, { origin, domains })).toBe(
    'https://go.brand.com/spring-promo',
  );
});

test('falls back to the default address when the domain is not known', () => {
  vi.stubEnv('LINKS_URL', '');

  expect(getLinkAddress({ slug: 'spring-promo', domainId: 'gone' }, { origin, domains })).toBe(
    'https://analytics.example.com/q/spring-promo',
  );
});
