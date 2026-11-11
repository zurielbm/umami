import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/render';
import { LinkQRCode } from './LinkQRCodeButton';

// jsdom has no canvas, so the PNG renderer is replaced; the SVG path runs for real.
vi.mock('@/lib/qr', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/qr')>()),
  getQrPngBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

const url = 'https://example.com/q/abc12345';

let downloads: { fileName: string; blob: Blob }[];
let lastBlob: Blob;

beforeEach(() => {
  downloads = [];

  URL.createObjectURL = vi.fn((blob: Blob) => {
    lastBlob = blob;
    return 'blob:test';
  });
  URL.revokeObjectURL = vi.fn();

  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({ fileName: this.download, blob: lastBlob });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('shows the code and the link it encodes', async () => {
  render(<LinkQRCode url={url} name="Spring promo" />);

  const image = await screen.findByAltText('QR code');

  expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
  expect(screen.getByLabelText('Link')).toHaveValue(url);
});

test('downloads the PNG under a name taken from the link', async () => {
  const { user } = render(<LinkQRCode url={url} name="Spring promo" />);

  await screen.findByAltText('QR code');
  await user.click(screen.getByRole('button', { name: 'Download PNG' }));

  await waitFor(() => expect(downloads).toHaveLength(1));
  expect(downloads[0].fileName).toBe('spring-promo-qr.png');
  expect(downloads[0].blob.type).toBe('image/png');
});

test('downloads the SVG under a name taken from the link', async () => {
  const { user } = render(<LinkQRCode url={url} name="Spring promo" />);

  await screen.findByAltText('QR code');
  await user.click(screen.getByRole('button', { name: 'Download SVG' }));

  await waitFor(() => expect(downloads).toHaveLength(1));
  expect(downloads[0].fileName).toBe('spring-promo-qr.svg');
  expect(downloads[0].blob.type).toBe('image/svg+xml');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
});

test('hides the copy button when the browser cannot copy images', async () => {
  render(<LinkQRCode url={url} />);

  await screen.findByAltText('QR code');

  expect(screen.queryByRole('button', { name: 'Copy image' })).not.toBeInTheDocument();
});

test('copies the code as a PNG when the browser supports it', async () => {
  const items: Record<string, unknown>[] = [];

  vi.stubGlobal(
    'ClipboardItem',
    class {
      constructor(data: Record<string, unknown>) {
        items.push(data);
      }
    },
  );

  // render() installs user-event's clipboard, so spy on it afterwards.
  const { user } = render(<LinkQRCode url={url} />);
  const write = vi.spyOn(navigator.clipboard, 'write').mockResolvedValue(undefined);

  await screen.findByAltText('QR code');
  await user.click(screen.getByRole('button', { name: 'Copy image' }));

  await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
  expect(Object.keys(items[0])).toEqual(['image/png']);
  expect(((await items[0]['image/png']) as Blob).type).toBe('image/png');
});
