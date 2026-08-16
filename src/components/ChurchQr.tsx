// ==========================================================================
// This Area Of Code Is: The Church Invitation QR.
// Explanation: Every church gets its own scannable door. The QR encodes
// https://praises.team/?church={code} — a phone camera pointed at it walks
// the person straight into THAT church's app door (no searching, no typing,
// no commercials between them and the service). Generated on-device with
// the battle-tested `qrcode` package — nothing leaves the phone.
// In Other Words: Print it on the invitation card; they scan; they're in.
// ==========================================================================

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function ChurchQr({ code, name }: { code: string; name: string }) {
  const [img, setImg] = useState('');
  const link = `https://praises.team/?church=${encodeURIComponent(code)}`;

  useEffect(() => {
    let alive = true;
    // High-contrast 1024px PNG — prints crisp on invitation cards.
    QRCode.toDataURL(link, {
      width: 1024, margin: 2, errorCorrectionLevel: 'M',
      color: { dark: '#17122a', light: '#ffffff' },
    }).then((url) => { if (alive) setImg(url); })
      .catch(() => { /* leave the button dead rather than show a broken image */ });
    return () => { alive = false; };
  }, [link]);

  const download = () => {
    if (!img) return;
    const a = document.createElement('a');
    a.href = img;
    a.download = `NTCCA-${code}-invite-qr.png`;
    a.click();
  };

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {img && (
        <img src={img} alt={`QR code linking to ${name}`}
             className="w-28 h-28 rounded-xl border border-[var(--glass-border)] bg-white p-1.5" />
      )}
      <div className="flex-1 min-w-[180px]">
        <p className="text-sm font-semibold">⛪ {name} — invitation QR</p>
        <p className="text-xs text-muted mt-0.5 break-all">{link}</p>
        <button className="glass-btn primary text-sm mt-2" onClick={download} disabled={!img}>
          ⬇ Download QR (PNG, print-ready)
        </button>
      </div>
    </div>
  );
}
