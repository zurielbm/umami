import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getLinkDomainHostnames } from '@/queries/prisma/linkDomain';
import { clearLinkDomainHostnames, isLinkDomainHostname } from './link-domain-hosts';

vi.mock('@/queries/prisma/linkDomain', () => ({
  getLinkDomainHostnames: vi.fn(),
}));

const getHostnames = vi.mocked(getLinkDomainHostnames);

beforeEach(() => {
  vi.useFakeTimers();
  getHostnames.mockReset();
  getHostnames.mockResolvedValue(['go.brand.com']);
  clearLinkDomainHostnames();
});

afterEach(() => {
  vi.useRealTimers();
});

test('loads the list once and answers from memory afterwards', async () => {
  expect(await isLinkDomainHostname('go.brand.com')).toBe(true);
  expect(await isLinkDomainHostname('other.com')).toBe(false);
  expect(getHostnames).toHaveBeenCalledTimes(1);
});

test('waits for a fresh list after a domain is added or removed', async () => {
  await isLinkDomainHostname('go.brand.com');

  getHostnames.mockResolvedValue(['go.brand.com', 'new.brand.com']);
  clearLinkDomainHostnames();

  expect(await isLinkDomainHostname('new.brand.com')).toBe(true);
});

test('refreshes an expired list in the background without making the request wait', async () => {
  await isLinkDomainHostname('go.brand.com');

  let finish: (hosts: string[]) => void = () => {};
  getHostnames.mockReturnValue(new Promise(resolve => (finish = resolve)));
  vi.advanceTimersByTime(61 * 1000);

  // Answered from the previous list while the refresh is still running.
  expect(await isLinkDomainHostname('go.brand.com')).toBe(true);
  expect(await isLinkDomainHostname('new.brand.com')).toBe(false);
  expect(getHostnames).toHaveBeenCalledTimes(2);

  finish(['new.brand.com']);
  await vi.advanceTimersByTimeAsync(0);

  expect(await isLinkDomainHostname('new.brand.com')).toBe(true);
  expect(await isLinkDomainHostname('go.brand.com')).toBe(false);
});

test('keeps the previous list when the database fails', async () => {
  await isLinkDomainHostname('go.brand.com');

  getHostnames.mockRejectedValue(new Error('down'));
  clearLinkDomainHostnames();

  expect(await isLinkDomainHostname('go.brand.com')).toBe(true);
});
