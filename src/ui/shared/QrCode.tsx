// QR code as one SVG path: no canvas, no inline style, dark on white in both themes.
import { useMemo } from 'preact/hooks';
import { encode } from 'uqr';

export function QrCode({ text, label }: { text: string; label: string }) {
  const { size, path } = useMemo(() => {
    const { data, size } = encode(text, { ecc: 'M', border: 2 });
    let d = '';
    data.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x},${y}h1v1h-1z`)));
    return { size, path: d };
  }, [text]);
  return (
    <svg class="qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shape-rendering="crispEdges">
      <rect class="qr-bg" width={size} height={size} />
      <path class="qr-dark" d={path} />
    </svg>
  );
}
