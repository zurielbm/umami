// Fork: server-side QR rendering. The browser renders its own (see qr.ts); this is for
// callers with no canvas, such as the MCP link tools.
import qrcode from 'qrcode';
import { QR_OPTIONS } from './qr';

export function getQrPngBuffer(text: string, width: number): Promise<Buffer> {
  return qrcode.toBuffer(text, { ...QR_OPTIONS, type: 'png', width });
}
