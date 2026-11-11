import qrcode from 'qrcode';

export type QrFormat = 'png' | 'svg';

export const QR_PNG_SIZE = 1024;

// Medium error correction keeps the code sparse enough to scan from a small print,
// and the 4-module margin is the quiet zone scanners expect.
export const QR_OPTIONS = { errorCorrectionLevel: 'M', margin: 4 } as const;

export function getQrSvg(text: string): Promise<string> {
  return qrcode.toString(text, { ...QR_OPTIONS, type: 'svg' });
}

/** Browser only: draws to a canvas. */
export async function getQrPngBlob(text: string, width = QR_PNG_SIZE): Promise<Blob> {
  const canvas = await qrcode.toCanvas(text, { ...QR_OPTIONS, width });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Could not render the QR code.'))),
      'image/png',
    );
  });
}

export function getQrSvgBlob(svg: string): Blob {
  return new Blob([svg], { type: 'image/svg+xml' });
}

export function getQrFileName(name: string | null | undefined, format: QrFormat): string {
  const base = (name ?? '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');

  return `${base || 'link'}-qr.${format}`;
}
