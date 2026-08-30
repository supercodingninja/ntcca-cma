# NTCCA Music App™

> **Gifted to New Testament Christian Churches of America, INC.**  
> by Reverend Frederick D. Thomas, Jr., NTCC Graham, WA  
> Class of 2011, Commissioned *Change Your World*  
> © 2026 — All Rights Reserved. Unauthorized use is strictly prohibited.

---

## What Is This?

The **NTCCA Music App™** is a browser-based worship music platform built exclusively for New Testament Christian Churches of America. It runs on iPad, iPhone, Android, and desktop — no app store required. Choir directors upload songs, musicians pick their part, and the whole band plays from the same setlist in perfect sync.

**Live at:** [praises.team](https://praises.team)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript |
| Bundler | Vite |
| Styling | Tailwind CSS + custom glass-morphism design system |
| Backend / Auth | Firebase (Auth + Firestore + Storage) |
| Hosting | Netlify |
| Notation | Custom HTML5 Canvas renderer (MusicXML) + PDF.js fallback + `.sib` metadata viewer |
| Audio | Web Audio API + on-device pitch recognition ("The Ear") |
| MIDI | Web MIDI API + Unity MIDI bridge |

---

## Repository Structure

```text
/ntcca-cma/
├── 📄 index.html              # Main entry
├── 📜 app.tsx                 # Root app component + routing
├── ⚙️ vite.config.ts          # Vite configuration
├── 📦 package.json            # Dependencies
├── 🔥 firebase.json           # Firebase hosting config
├── 📋 firestore.rules         # Database security rules
├── 📱 manifest.json           # PWA configuration
├── ⚙️ sw.ts                  # Service worker
│
├── src/
│   ├── components/
│   │   ├── ui/                # shadcn/ui primitives (Button, Card, Dialog, etc.)
│   │   ├── PdfViewer.tsx      # PDF.js inline viewer
│   │   ├── SibViewer.tsx      # 🆕 .sib metadata + note preview viewer
│   │   ├── EngravedSheet.tsx  # Canvas-based notation renderer
│   │   └── ... (17 total custom components)
│   │
│   ├── sections/
│   │   ├── SongViewSection.tsx    # 🆕 Now routes .sib → SibViewer
│   │   ├── PracticeTools.tsx
│   │   ├── EnsayoRoom.tsx
│   │   ├── ConductorSection.tsx
│   │   ├── ArrangeBoard.tsx
│   │   ├── ListenPanel.tsx        # "The Ear" — on-device recognition
│   │   └── ... (26 total section files)
│   │
│   ├── pages/
│   │   ├── Home.tsx
│   │   └── Login.tsx
│   │
│   ├── hooks/
│   │   └── use-mobile.ts
│   │
│   ├── lib/
│   │   ├── music.ts           # Transposition, key math, instrument offsets
│   │   ├── fileStore.ts       # IndexedDB vault + URL resolution
│   │   ├── media.ts           # YouTube embed, video detection
│   │   ├── attachments.ts     # Attachment type map + icons
│   │   ├── i18n.ts            # Internationalization
│   │   ├── practice.ts        # Practice module (partial)
│   │   ├── parts.ts           # Band part definitions
│   │   ├── instruments.ts     # Instrument registry (concert, B♭, E♭, etc.)
│   │   ├── songs.ts           # Song data types + helpers
│   │   └── ... (40+ modules total)
│   │
│   │   └── sib/
│   │       └── parser.ts      # 🆕 .sib binary scanner (zero dependencies)
│   │
│   │   └── musicxml/
│   │       ├── types.ts       # MusicXML type system (Phase 2)
│   │       └── parser.ts      # DOM-based MusicXML parser (Phase 2)
│   │
│   │   └── omniscore/
│   │       ├── acoustic/      # Audio analysis
│   │       ├── omr/           # Optical music recognition
│   │       └── pitch.ts       # Pitch detection engine
│   │
│   ├── styles/
│   │   ├── globals.css        # Tailwind + CSS variables
│   │   ├── glass.css          # Glass-morphism utilities
│   │   ├── SibViewer.css      # 🆕 SibViewer component styles
│   │   └── ... (8 total CSS files)
│   │
│   └── unity/
│       ├── UnityConductor.tsx
│       ├── UnityMediaPipe.tsx
│       ├── UnityMidi.tsx
│       └── midi.ts
│
├── public/
│   └── ... (static assets)
│
└── 📸 screenshots/            # App screenshots for docs
```

---

## Three-Tier Rendering Strategy

| Tier | Format | Renderer | Status |
|------|--------|----------|--------|
| **1 — Primary** | `.musicxml`, `.xml`, `.mxl` | Custom HTML5 Canvas engine | Phase 2 (in progress) |
| **2 — Fallback** | `.pdf` | PDF.js | ✅ Built |
| **3 — Last Resort** | `.sib` | `SibViewer` (metadata + note preview) | ✅ **Live** |

### How `.sib` Files Work Now

When a song has a `.sib` attachment, `SongViewSection.tsx` detects it by filename and renders the `SibViewer` component inline:

```tsx
// src/sections/SongViewSection.tsx
import SibViewer from '../components/SibViewer';

// Inside renderAttachment():
if (a.name?.toLowerCase().endsWith('.sib')) {
  return (
    <div key={a.id} className="glass-card p-3">
      <SibViewer fileUrl={url ?? a.ref} fileName={a.name} />
    </div>
  );
}
```

The `SibViewer` displays:
- Extracted metadata (title, composer, arranger, copyright)
- Sibelius version detected from file header
- Heuristically extracted pitch chips with octave labels
- Download button for the original file
- Tip banner recommending MusicXML export for full accuracy

---

## Key Features

- **🎼 Live Transposition** — Sharp/flat-aware key changes with capo calculator
- **🎷 Band Parts** — One tap switches the chart to any instrument's written key (B♭, E♭, F, etc.)
- **▶ Auto-Scroll** — Hands-free scrolling for stage use (requestAnimationFrame-driven)
- **🎧 The Ear** — On-device audio recognition engine (no cloud)
- **📎 Multi-Format Attachments** — PDF, MusicXML, `.sib`, audio, video per song
- **🎼 Part Picker** — Each musician views only their staff (SATB, band, orchestra)
- **🔒 SCN TrustShield™ + SCN Ledger™** — Token-only verification, no personal data stored, CPA-ready financial reporting
- **♿ ADA/WCAG Compliant** — Screen-reader-ready policy modals, plain-language summaries

---

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Deploy to Netlify (via Firebase hosting)
npm run deploy
```

---

## Governance & Legal

- **Nonprofit Religious Educational Purpose** — Operated under good-faith use
- **No Reverse Engineering** — `.sib` parser uses heuristic scanning only; full format decoding is not pursued
- **CCLI Compliance** — Federal-compliant credits: original artist, label, publisher, CCLI number
- **SCN Commerce Policy** — All physical merchandise sales FINAL; digital refundable 48hrs if never downloaded
- **Privacy** — No personal data stored; Stripe token-only verification; 3-download limit per purchase

---

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | `.sib` binary scanner + `SibViewer` component |
| Phase 1b | ✅ Complete | `SibViewer` wired into `SongViewSection.tsx` |
| Phase 2 | 🔄 In Progress | MusicXML type system + DOM parser + Canvas renderer v1 |
| Phase 3 | ⏳ Pending | Full integration: MusicXML routing, multi-staff rendering, part picker |
| Phase 4 | ⏳ Pending | Polish: dynamics, slurs, ties, accessibility, virtual scrolling |

---

## Contact

**Reverend Frederick D. Thomas, Jr.**  
NTCC Graham, WA  
Class of 2011, Commissioned *Change Your World*

---

*Every note is a yes. We find a way.*
