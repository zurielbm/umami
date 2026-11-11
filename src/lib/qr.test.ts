import { describe, expect, test } from 'vitest';
import { getQrFileName, getQrSvg, getQrSvgBlob } from './qr';

describe('getQrSvg', () => {
  test('renders an SVG document for a link', async () => {
    const svg = await getQrSvg('https://example.com/q/abc12345');

    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('viewBox');
  });

  test('renders a different code for a different link', async () => {
    const first = await getQrSvg('https://example.com/q/abc12345');
    const second = await getQrSvg('https://example.com/q/xyz98765');

    expect(first).not.toBe(second);
  });
});

describe('getQrSvgBlob', () => {
  test('is typed as an SVG image', () => {
    expect(getQrSvgBlob('<svg />').type).toBe('image/svg+xml');
  });
});

describe('getQrFileName', () => {
  test('turns the link name into a safe file name', () => {
    expect(getQrFileName('Spring Promo 2026!', 'png')).toBe('spring-promo-2026-qr.png');
  });

  test('strips accents and keeps letters from other alphabets', () => {
    expect(getQrFileName('Añadir menú', 'svg')).toBe('anadir-menu-qr.svg');
    expect(getQrFileName('春のセール', 'png')).toBe('春のセール-qr.png');
  });

  test('falls back when the name has no usable characters', () => {
    expect(getQrFileName('///', 'png')).toBe('link-qr.png');
    expect(getQrFileName(undefined, 'svg')).toBe('link-qr.svg');
  });

  test('does not leave a path separator or a trailing dash', () => {
    const fileName = getQrFileName(`../../etc/${'a'.repeat(58)}-b`, 'png');

    expect(fileName).not.toContain('/');
    expect(fileName).not.toContain('--');
    expect(fileName).toMatch(/[a-z]-qr\.png$/);
  });
});
