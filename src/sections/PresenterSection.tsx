// ==========================================================================
// This Area Of Code Is: The Presenter (ProPresenter parity — replace OR
// integrate). Explanation: Everything ProPresenter does for a worship
// service, here: lyric slides built from the song library, on-the-fly KJV
// scripture slides, announcement slides, an operator screen with
// black/logo/clear and arrow-key control, a projector output window, a
// stage (confidence) display with next-slide + countdown clock — and a
// ProPresenter Link panel that DRIVES an existing ProPresenter machine over
// Wi-Fi when a church wants to keep theirs.
// In Other Words: The worship screen, the operator's console, and the
// team's confidence monitor — one tab, zero dollars.
// ==========================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadAllSongs } from '../lib/songs';
import type { Song } from '../lib/music';
import { getPassage, passageToSlides } from '../lib/bible';
import { loadPPLink, savePPLink, testPP, ppTrigger, parsePPText, parseOpenLyrics } from '../lib/propresenter';
import { saveSong } from '../lib/songs';

export interface Slide { title: string; lines: string[]; tag?: string }
interface DeckItem { id: string; label: string; slides: Slide[] }

type OutMode = 'normal' | 'black' | 'logo' | 'clear';

const DECK_KEY = 'ntcc.presenter.deck';
const chan = () => new BroadcastChannel('ntcc.presenter');

function loadDeck(): DeckItem[] {
  try {
    const raw = localStorage.getItem(DECK_KEY);
    if (raw) return JSON.parse(raw) as DeckItem[];
  } catch { /* fall through */ }
  return [];
}

// ---------- popup windows (projector + stage display) ----------
function openWindowWithListener(title: string, stage: boolean): Window | null {
  const w = window.open('', '_blank', stage ? 'width=800,height=450' : 'width=1280,height=720');
  if (!w) return null;
  w.document.write(`<!doctype html><html><head><title>${title}</title><style>
    html,body{margin:0;height:100%;background:#000;color:#fff;font-family:MiSans,sans-serif;
    display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:4vw}
    h2{color:#B08D3E;font-size:2.2vw;margin:0 0 2vh}
    .lines{font-size:3.2vw;line-height:1.5;white-space:pre-wrap;font-weight:600}
    .tag{position:fixed;top:12px;left:16px;font-size:14px;color:#888}
    .clock{position:fixed;top:12px;right:16px;font-size:18px;color:#aaa;font-variant-numeric:tabular-nums}
    .next{position:fixed;bottom:14px;left:16px;right:16px;font-size:1.2vw;color:#777;text-align:left}
    img{max-width:40vw;max-height:40vh}
  </style></head><body>
    <div class="tag" id="tag"></div><div class="clock" id="clock"></div>
    <h2 id="t"></h2><div class="lines" id="l"></div><div class="next" id="n"></div>
  <script>
    var mode='normal';
    var ch=new BroadcastChannel('ntcc.presenter');
    ch.onmessage=function(e){
      var d=e.data;
      if(d.kind==='slide'){
        mode=d.mode;
        var show=d.mode==='normal';
        document.getElementById('t').textContent=show?d.slide.title:'';
        document.getElementById('l').textContent=show?d.slide.lines.join('\\n'):'';
        document.getElementById('l').style.display=show?'block':'none';
        document.getElementById('t').style.display=show?'block':'none';
        document.getElementById('tag').textContent=d.mode==='black'?'BLACK':d.mode==='clear'?'CLEAR':'';
        ${stage
          ? "document.getElementById('n').textContent=d.next?('NEXT: '+d.next.title+' — '+d.next.lines[0]):'(end)';"
          : "document.getElementById('n').textContent='';"}
      }
      if(d.kind==='countdown'){ window._cd=d.until; }
    };
    setInterval(function(){
      var el=document.getElementById('clock');
      if(window._cd){ var s=Math.max(0,Math.round((window._cd-Date.now())/1000));
        el.textContent='⏱ '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }
      else { el.textContent=new Date().toLocaleTimeString(); }
    },1000);
  </script></body></html>`);
  w.document.close();
  return w;
}

// ================================================================= component
export default function PresenterSection() {
  const [songs] = useState<Song[]>(loadAllSongs);
  const [deck, setDeck] = useState<DeckItem[]>(loadDeck);
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<OutMode>('normal');
  const [verse, setVerse] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [songPick, setSongPick] = useState('');
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [cdMin, setCdMin] = useState('');
  const [pp, setPp] = useState(loadPPLink());
  const projRef = useRef<Window | null>(null);
  const stageRef = useRef<Window | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const chRef = useRef<BroadcastChannel | null>(null);

  const slides = useMemo(() => deck.flatMap((d) => d.slides), [deck]);
  const slide = slides[idx];

  const persist = (d: DeckItem[]) => {
    setDeck(d);
    localStorage.setItem(DECK_KEY, JSON.stringify(d));
  };

  // broadcast current state to projector/stage windows
  const push = useCallback((i: number, m: OutMode, sl = slides) => {
    if (!chRef.current) chRef.current = chan();
    chRef.current.postMessage({ kind: 'slide', mode: m, slide: sl[i] ?? { title: '', lines: [] }, next: sl[i + 1] });
  }, [slides]);

  useEffect(() => { push(idx, mode); }, [idx, mode, push]);

  const go = useCallback((d: number) => {
    setIdx((i) => Math.max(0, Math.min(slides.length - 1, i + d)));
    setMode('normal');
  }, [slides.length]);

  // operator keyboard: ←→ advance, B black, L logo, C clear
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key.toLowerCase() === 'b') setMode('black');
      if (e.key.toLowerCase() === 'l') setMode('logo');
      if (e.key.toLowerCase() === 'c') setMode('clear');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // ---------- deck builders ----------
  const addSong = () => {
    const s = songs.find((x) => x.id === songPick);
    if (!s) return;
    persist([...deck, {
      id: `song-${s.id}`, label: `🎵 ${s.title}`,
      slides: s.sections
        .map((sec) => ({
          title: `${s.title} — ${sec.label}`,
          tag: `${s.key} · ${s.bpm} BPM`,
          lines: sec.lines
            .map((l) => l.segments.map((g) => g.lyric).join('').trim())
            .filter(Boolean),
        }))
        .filter((sl) => sl.lines.length > 0),
    }]);
    setSongPick('');
  };

  const addScripture = async () => {
    if (!verse.trim()) return;
    setBusy(true); setMsg('');
    try {
      const p = await getPassage(verse);
      persist([...deck, { id: `bible-${p.reference}`, label: `📖 ${p.reference} (KJV)`, slides: passageToSlides(p).map((s) => ({ ...s, tag: 'KJV' })) }]);
      setVerse('');
      setMsg(`✅ ${p.reference} added (${p.verses.length} verses, KJV) — cached on this device for offline.`);
    } catch (e) { setMsg(`⚠️ ${(e as Error).message}`); }
    setBusy(false);
  };

  const addAnnouncement = () => {
    if (!annTitle.trim()) return;
    persist([...deck, { id: `ann-${Date.now()}`, label: `📣 ${annTitle}`, slides: [{ title: annTitle, lines: annBody.split('\n').filter(Boolean), tag: 'Announcement' }] }]);
    setAnnTitle(''); setAnnBody('');
  };

  // This Area Of Code Is: The ProPresenter Import (the "replace" path).
  // Explanation: ProPresenter's "Export Text Bundle" (or any lyrics .txt,
  // slides split by blank lines) and OpenLyrics .xml files import straight
  // into THIS app's library as songs — then present from here and never
  // look back.
  const importPP = async (f: File) => {
    const text = await f.text();
    const parsed = f.name.toLowerCase().endsWith('.xml')
      ? parseOpenLyrics(text, f.name.replace(/\.\w+$/, ''))
      : parsePPText(text, f.name.replace(/\.\w+$/, ''));
    if (!parsed) { setMsg('⚠️ Could not read that file as lyrics.'); return; }
    saveSong({
      id: `imported-${Date.now()}`,
      title: parsed.title,
      artist: 'Imported',
      credit: 'Imported lyrics — verify attribution before publishing.',
      key: 'G',
      bpm: 72,
      timeSignature: '4/4',
      language: 'en',
      sections: parsed.slides.map((lines, i) => ({
        kind: 'verse' as const,
        label: `Slide ${i + 1}`,
        lines: lines.map((t) => ({ segments: [{ chord: '', lyric: t }] })),
      })),
    });
    setMsg(`✅ "${parsed.title}" imported into the library (${parsed.slides.length} slides) — add it to the deck above.`);
  };

  const startCountdown = () => {
    const min = Number(cdMin);
    if (!min) return;
    if (!chRef.current) chRef.current = chan();
    chRef.current.postMessage({ kind: 'countdown', until: Date.now() + min * 60000 });
    setMsg(`⏱ ${min}-minute countdown running on the outputs.`);
  };

  // ---------- PP link ----------
  const linkTest = async () => {
    setBusy(true);
    const r = await testPP(pp.ip);
    setPp(r);
    setMsg(r.connected ? `✅ ProPresenter linked (${r.version ?? 'online'}) — you can drive it from here.` : '⚠️ No answer. On the ProPresenter machine: Preferences → Network → enable the API, then check the IP.');
    setBusy(false);
  };

  const ctrlBtn = 'glass-btn px-4 py-3 text-lg';
  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <header className="text-center">
        <h2 className="text-2xl font-bold">📽 Presenter</h2>
        <p className="text-muted text-sm">Lyric slides · KJV scripture on-the-fly · projector + stage display · ProPresenter link</p>
      </header>

      {/* OPERATOR CONSOLE */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold">🎛 Operator</h3>
          <span className="text-sm text-muted">{slides.length ? `Slide ${idx + 1} / ${slides.length}` : 'Deck is empty — build it below'}</span>
        </div>

        <div className="rounded-xl bg-black border border-[var(--glass-border)] p-6 min-h-44 text-center">
          {mode !== 'normal' ? (
            <p className="text-3xl font-bold text-muted mt-8">{mode === 'black' ? '⬛ BLACK' : mode === 'clear' ? '◻ CLEAR' : '🕊 LOGO'}</p>
          ) : slide ? (
            <>
              <p className="text-accent text-sm">{slide.title}{slide.tag ? ` · ${slide.tag}` : ''}</p>
              <p className="text-xl font-semibold whitespace-pre-wrap mt-2">{slide.lines.join('\n')}</p>
            </>
          ) : (
            <p className="text-muted mt-8">No slides yet — add songs, scripture, or announcements below.</p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap justify-center">
          <button className={ctrlBtn} onClick={() => go(-1)} aria-label="Previous slide">⬅</button>
          <button className={`${ctrlBtn} primary`} onClick={() => go(1)} aria-label="Next slide">➡</button>
          <button className={ctrlBtn} onClick={() => setMode('black')}>⬛ Black <span className="text-xs">(B)</span></button>
          <button className={ctrlBtn} onClick={() => setMode('logo')}>🕊 Logo <span className="text-xs">(L)</span></button>
          <button className={ctrlBtn} onClick={() => setMode('clear')}>◻ Clear <span className="text-xs">(C)</span></button>
          <button className={ctrlBtn} onClick={() => document.documentElement.requestFullscreen?.()}>⛶ Fullscreen</button>
        </div>

        <div className="flex gap-2 flex-wrap justify-center">
          <button className="glass-btn" onClick={() => {
            projRef.current = openWindowWithListener('NTCCA Projector', false);
            // Popup blocked? Say so — never write slides into a dead window.
            if (!projRef.current) { setMsg('⚠️ Pop-up blocked — allow pop-ups for this site, then try again.'); return; }
            setTimeout(() => push(idx, mode), 500);
          }}>
            🖥 Open projector window
          </button>
          <button className="glass-btn" onClick={() => {
            stageRef.current = openWindowWithListener('NTCCA Stage Display', true);
            if (!stageRef.current) { setMsg('⚠️ Pop-up blocked — allow pop-ups for this site, then try again.'); return; }
            setTimeout(() => push(idx, mode), 500);
          }}>
            🎤 Open stage display
          </button>
          <input className="auth-input !w-24" inputMode="numeric" placeholder="min" value={cdMin}
                 onChange={(e) => setCdMin(e.target.value.replace(/\D/g, ''))} aria-label="Countdown minutes" />
          <button className="glass-btn" onClick={startCountdown}>⏱ Countdown</button>
        </div>
        {msg && <p className="text-sm text-center">{msg}</p>}
      </div>

      {/* DECK BUILDER */}
      <div className="glass-card p-5 space-y-3">
        <h3 className="font-semibold">🧱 Build the service</h3>
        <div className="flex gap-2 flex-wrap">
          <select className="auth-input flex-1" value={songPick} onChange={(e) => setSongPick(e.target.value)} aria-label="Add song slides">
            <option value="">＋ Add song lyrics…</option>
            {songs.map((s) => <option key={s.id} value={s.id}>{s.title} ({s.key})</option>)}
          </select>
          <button className="glass-btn primary" onClick={addSong} disabled={!songPick}>Add song</button>
        </div>
        <div className="flex gap-2">
          <input className="auth-input flex-1" placeholder='📖 Scripture — e.g. "John 3:16" or "Psalm 23" (KJV)'
                 value={verse} onChange={(e) => setVerse(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') void addScripture(); }} aria-label="Scripture reference" />
          <button className="glass-btn primary" onClick={() => void addScripture()} disabled={busy || !verse.trim()}>Add KJV</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input className="auth-input" placeholder="📣 Announcement title" value={annTitle}
                 onChange={(e) => setAnnTitle(e.target.value)} aria-label="Announcement title" />
          <button className="glass-btn" onClick={addAnnouncement} disabled={!annTitle.trim()}>Add announcement</button>
          <textarea className="auth-input sm:col-span-2" rows={2} placeholder="Announcement body (one line per slide line)"
                    value={annBody} onChange={(e) => setAnnBody(e.target.value)} aria-label="Announcement body" />
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <button className="glass-btn text-sm" onClick={() => importRef.current?.click()}>
            ⬆ Import ProPresenter export (.txt / OpenLyrics .xml)
          </button>
          <input ref={importRef} type="file" accept=".txt,.xml,text/plain,text/xml" hidden
                 onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importPP(f); }} />
          <span className="text-xs text-muted">Slides split by blank lines; first line = title.</span>
        </div>

        {deck.length > 0 && (
          <>
            <ul className="space-y-1 text-sm">
              {deck.map((d, i) => (
                <li key={d.id} className="flex justify-between border-b border-[var(--glass-border)] py-1">
                  <span>{i + 1}. {d.label} <span className="text-muted">({d.slides.length} slides)</span></span>
                  <button className="glass-btn text-xs" onClick={() => persist(deck.filter((x) => x.id !== d.id))}>Remove</button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button className="glass-btn text-sm" onClick={() => { setIdx(0); setMode('normal'); }}>▶ Start from top</button>
              <button className="glass-btn text-sm" onClick={() => persist([])}>🗑 Clear deck</button>
            </div>
          </>
        )}
      </div>

      {/* PROPRESENTER LINK — integrate with the church's existing rig */}
      <div className="glass-card p-5 space-y-3">
        <h3 className="font-semibold">🔗 ProPresenter Link <span className="text-muted text-sm font-normal">(optional — drive their existing machine)</span></h3>
        <p className="text-sm text-muted">
          If the church keeps ProPresenter for now: on that machine enable Preferences → Network → API,
          enter its IP here, and this app advances its slides over Wi-Fi. When they're ready, present
          from here and retire it — your call.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input className="auth-input flex-1" inputMode="url" autoCapitalize="off" placeholder="ProPresenter IP (e.g. 192.168.1.50)"
                 value={pp.ip} onChange={(e) => { const n = { ...pp, ip: e.target.value }; setPp(n); savePPLink(n); }}
                 aria-label="ProPresenter IP address" />
          <button className="glass-btn primary" onClick={() => void linkTest()} disabled={busy || !pp.ip.trim()}>
            {pp.connected ? '🟢 Linked' : 'Test link'}
          </button>
        </div>
        {pp.connected && (
          <div className="flex gap-2">
            <button className="glass-btn" onClick={() => void ppTrigger(pp.ip, 'previous')}>⬅ PP Prev</button>
            <button className="glass-btn primary" onClick={() => void ppTrigger(pp.ip, 'next')}>➡ PP Next</button>
            <button className="glass-btn" onClick={() => void ppTrigger(pp.ip, 'clear')}>◻ PP Clear</button>
          </div>
        )}
      </div>
    </div>
  );
}
