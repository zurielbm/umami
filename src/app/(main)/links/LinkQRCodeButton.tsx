import { Button, Column, Row, TextField } from '@umami/react-zen';
import { useEffect, useRef, useState } from 'react';
import { IconLabel } from '@/components/common/IconLabel';
import { useMessages } from '@/components/hooks';
import { Check, Copy, Download, QrCode } from '@/components/icons';
import { DialogButton } from '@/components/input/DialogButton';
import { getQrFileName, getQrPngBlob, getQrSvg, getQrSvgBlob, type QrFormat } from '@/lib/qr';

export function LinkQRCodeButton({
  url,
  name,
  showLabel,
}: {
  url: string;
  name?: string;
  showLabel?: boolean;
}) {
  const { t, labels } = useMessages();
  const title = t(labels.qrCode);

  return (
    <DialogButton
      icon={<QrCode />}
      label={showLabel ? title : undefined}
      title={title}
      aria-label={title}
      variant={showLabel ? undefined : 'quiet'}
      width="400px"
    >
      <LinkQRCode url={url} name={name} />
    </DialogButton>
  );
}

function saveBlob(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = href;
  anchor.download = fileName;
  anchor.click();

  URL.revokeObjectURL(href);
}

function canCopyImage() {
  return typeof ClipboardItem !== 'undefined' && !!globalThis.navigator?.clipboard?.write;
}

export function LinkQRCode({ url, name }: { url: string; name?: string }) {
  const { t, labels } = useMessages();
  const [svg, setSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    setSvg(null);
    getQrSvg(url).then(
      value => active && setSvg(value),
      () => active && setSvg(null),
    );

    return () => {
      active = false;
    };
  }, [url]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleDownload = async (format: QrFormat) => {
    const blob = format === 'svg' ? getQrSvgBlob(svg as string) : await getQrPngBlob(url);

    saveBlob(blob, getQrFileName(name, format));
  };

  const handleCopy = async () => {
    // Safari only allows a clipboard write that starts inside the click, so hand it the
    // pending blob instead of awaiting it first.
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': getQrPngBlob(url) })]);
    } catch {
      // The browser refused the clipboard write (permission or focus); leave the button as is.
      return;
    }

    setCopied(true);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Column gap="5" alignItems="center">
      <div
        style={{
          width: 240,
          maxWidth: '100%',
          aspectRatio: '1',
          background: '#fff',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {svg && (
          <img
            src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
            alt={t(labels.qrCode)}
            style={{ display: 'block', width: '100%', height: '100%' }}
          />
        )}
      </div>
      <TextField
        value={url}
        aria-label={t(labels.link)}
        autoComplete="off"
        isReadOnly
        allowCopy
        style={{ width: '100%' }}
      />
      <Row gap="3" wrap="wrap" justifyContent="center">
        <Button variant="primary" isDisabled={!svg} onPress={() => handleDownload('png')}>
          <IconLabel icon={<Download />} label={`${t(labels.download)} PNG`} />
        </Button>
        <Button isDisabled={!svg} onPress={() => handleDownload('svg')}>
          <IconLabel icon={<Download />} label={`${t(labels.download)} SVG`} />
        </Button>
        {canCopyImage() && (
          <Button isDisabled={!svg} onPress={handleCopy}>
            <IconLabel icon={copied ? <Check /> : <Copy />} label={t(labels.copyImage)} />
          </Button>
        )}
      </Row>
    </Column>
  );
}
