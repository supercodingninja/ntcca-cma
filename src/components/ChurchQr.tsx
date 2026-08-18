// Copyright © 2026 Reverend Frederick D. Thomas, Jr. — All Rights Reserved.
// Unauthorized use is strictly prohibited.

import { useState, useEffect, useMemo, useCallback } from 'react';
import QRCode from 'qrcode';
import { CHURCH_REGISTRY, churchUrl, type ChurchEntry } from '../lib/churches';

// ==========================================================================
// This Area Of Code Is: Church QR Code Generator
// Explanation: Generates scannable QR codes for every church in the
//              CHURCH_REGISTRY. Each QR code links to the church's
//              praises.team subdomain. Uses the qrcode package already
//              in package.json — no new installs needed.
// In Other Words: Print these out, tape them to the bulletin board,
//                 and visitors scan straight to their church's door.
// ==========================================================================

interface QrItem {
  church: ChurchEntry;
  dataUrl: string;
}

export default function ChurchQr() {
  const [qrList, setQrList] = useState<QrItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedKind, setSelectedKind] = useState<string>('all');

  // Generate QR codes on mount
  useEffect(() => {
    let cancelled = false;
    const churches = CHURCH_REGISTRY.filter((c) => c.kind !== 'org');

    Promise.all(
      churches.map(async (church) => {
        const url = churchUrl(church.code);
        const dataUrl = await QRCode.toDataURL(url, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
        return { church, dataUrl };
      })
    ).then((items) => {
      if (!cancelled) {
        setQrList(items);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let list = qrList;
    if (selectedKind !== 'all') {
      list = list.filter((item) => item.church.kind === selectedKind);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (item) =>
          item.church.name.toLowerCase().includes(q) ||
          item.church.location.toLowerCase().includes(q)
      );
    }
    return list;
  }, [qrList, query, selectedKind]);

  const downloadPng = useCallback((dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-white/50 animate-pulse">Generating QR codes…</div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-6 md:px-8">
      <h2 className="mb-2 text-2xl font-bold tracking-tight text-white">Church QR Codes</h2>
      <p className="mb-6 text-sm text-white/50">
        Scan any code to open that church's praises.team page.
      </p>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search church or city…"
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-white/30 outline-none focus:border-amber-500"
        />
        <select
          value={selectedKind}
          onChange={(e) => setSelectedKind(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-500"
        >
          <option value="all">All Types</option>
          <option value="church">Churches</option>
          <option value="seminary">Seminaries</option>
          <option value="campground">Campground</option>
        </select>
      </div>

      {/* Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map(({ church, dataUrl }) => (
          <div
            key={church.code}
            className="flex flex-col items-center rounded-xl border border-white/10 bg-white/5 p-4 text-center"
          >
            <img
              src={dataUrl}
              alt={`QR code for ${church.name}`}
              className="mb-3 h-48 w-48 rounded-lg bg-white"
            />
            <h3 className="text-sm font-semibold text-white">{church.name}</h3>
            <p className="text-xs text-white/50">{church.location}</p>
            <p className="mt-1 text-[10px] text-amber-500/70">{churchUrl(church.code)}</p>
            <button
              onClick={() => downloadPng(dataUrl, `${church.code}-qr.png`)}
              className="mt-3 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 hover:text-black"
            >
              Download PNG
            </button>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-12 text-center text-white/40">No churches match your search.</p>
      )}

      <p className="mt-6 text-xs text-white/30">
        {filtered.length} QR code{filtered.length !== 1 ? 's' : ''} displayed
      </p>
    </div>
  );
}
