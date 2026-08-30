// Copyright © 2026 NTCCA Music App™ — All Rights Reserved.
// Gifted to New Testament Christian Churches of America, INC.
// by Reverend Frederick D. Thomas, Jr., NTCC Graham, WA
// | Class of 2011, Commissioned Change Your World
// Unauthorized use is strictly prohibited.

import type {
  ScorePartwise,
  ScoreMetadata,
  Part,
  Measure,
  Note,
  NoteStep,
} from '../musicxml/types';

interface SibVersionInfo {
  version: number;
  versionName: string;
  encoding: 'ascii' | 'utf16le' | 'utf8';
  headerSize: number;
}

const SIB_SIGNATURES: Record<string, number> = {
  '0F': 1, '1F': 2, '2F': 3, '3F': 4, '4F': 5,
  '5F': 6, '6F': 7, '7F': 2020, '8F': 2021,
  '9F': 2022, 'AF': 2023, 'BF': 2024,
};

class BinaryReader {
  private buffer: ArrayBuffer;
  private view: DataView;
  private position: number = 0;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
  }

  get length(): number { return this.buffer.byteLength; }
  seek(offset: number): void { this.position = Math.max(0, Math.min(offset, this.length)); }
  u8(): number { const v = this.view.getUint8(this.position); this.position++; return v; }
  u16(): number { const v = this.view.getUint16(this.position, true); this.position += 2; return v; }
  bytes(n: number): Uint8Array {
    const end = Math.min(this.position + n, this.length);
    const s = new Uint8Array(this.buffer, this.position, end - this.position);
    this.position = end;
    return s;
  }

  extractStrings(minLen = 4, enc: 'ascii' | 'utf16le' = 'ascii'): string[] {
    const b = new Uint8Array(this.buffer);
    const out: string[] = [];
    let cur = '';
    if (enc === 'utf16le') {
      for (let i = 0; i < b.length - 1; i += 2) {
        const c = b[i] | (b[i + 1] << 8);
        if (c >= 32 && c < 127) cur += String.fromCharCode(c);
        else { if (cur.length >= minLen) out.push(cur); cur = ''; }
      }
    } else {
      for (let i = 0; i < b.length; i++) {
        if (b[i] >= 32 && b[i] < 127) cur += String.fromCharCode(b[i]);
        else { if (cur.length >= minLen) out.push(cur); cur = ''; }
      }
    }
    if (cur.length >= minLen) out.push(cur);
    return [...new Set(out)];
  }
}

export interface SibParseResult {
  success: boolean;
  score?: ScorePartwise;
  metadata?: ScoreMetadata;
  extractedStrings: string[];
  versionInfo?: SibVersionInfo;
  warnings: string[];
  error?: string;
}

export class SibeliusParser {
  private warnings: string[] = [];

  async parse(file: File | ArrayBuffer): Promise<SibParseResult> {
    this.warnings = [];
    try {
      const buffer = file instanceof File ? await file.arrayBuffer() : file;
      const reader = new BinaryReader(buffer);

      // Version detection
      const versionInfo = this.detectVersion(reader);
      if (!versionInfo) {
        return { success: false, extractedStrings: [], warnings: this.warnings, error: 'Invalid .sib file' };
      }

      // Extract strings
      const asciiStrings = reader.extractStrings(4, 'ascii');
      const utf16Strings = reader.extractStrings(4, 'utf16le');
      const allStrings = [...new Set([...asciiStrings, ...utf16Strings])];

      // Harvest metadata
      const metadata = this.harvestMetadata(allStrings, versionInfo);

      // Attempt note extraction
      const notes = this.attemptNoteExtraction(reader, versionInfo);

      // Build score
      const score = this.buildScore(notes, metadata, versionInfo);

      return {
        success: true,
        score,
        metadata,
        extractedStrings: allStrings,
        versionInfo,
        warnings: this.warnings,
      };
    } catch (err) {
      return {
        success: false,
        extractedStrings: [],
        warnings: this.warnings,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private detectVersion(reader: BinaryReader): SibVersionInfo | null {
    if (reader.length < 16) return null;
    const firstByte = reader.u8();
    reader.seek(0);

    const header = reader.bytes(Math.min(64, reader.length));
    reader.seek(0);

    const sibName = [0x53,0x69,0x62,0x65,0x6C,0x69,0x75,0x73];
    let sibPos = -1;
    for (let i = 0; i <= header.length - sibName.length; i++) {
      let match = true;
      for (let j = 0; j < sibName.length; j++) if (header[i+j] !== sibName[j]) { match = false; break; }
      if (match) { sibPos = i; break; }
    }

    if (sibPos >= 0) {
      const marker = header[sibPos + 8] || 0;
      const names: Record<number, string> = {
        1:'1.x',2:'2.x',3:'3.x',4:'4.x',5:'5.x',6:'6.x',7:'7.x',
        8:'8.x/2020',9:'2021',10:'2022',11:'2023',12:'2024'
      };
      return {
        version: marker,
        versionName: `Sibelius ${names[marker] || 'unknown'}`,
        encoding: marker >= 7 ? 'utf16le' : 'ascii',
        headerSize: 64,
      };
    }

    const sigHex = firstByte.toString(16).toUpperCase().padStart(2,'0');
    if (SIB_SIGNATURES[sigHex]) {
      const v = SIB_SIGNATURES[sigHex];
      return { version: v, versionName: `Sibelius ${v}.x`, encoding: v >= 7 ? 'utf16le' : 'ascii', headerSize: 32 };
    }

    if (reader.length > 100) {
      this.warnings.push('Unknown Sibelius version. Attempting generic parse.');
      return { version: 0, versionName: 'Sibelius (unknown)', encoding: 'utf16le', headerSize: 0 };
    }
    return null;
  }

  private harvestMetadata(strings: string[], versionInfo: SibVersionInfo): ScoreMetadata {
    const metadata: ScoreMetadata = { software: versionInfo.versionName };

    // Filter out garbage strings (too many special chars = not a title)
    const isCleanString = (s: string): boolean => {
      const special = s.replace(/[a-zA-Z0-9\s\-\(\)\.\,\&\']/g, '');
      return special.length < s.length * 0.3 && s.length > 3 && s.length < 120;
    };

    const candidates = strings
      .filter(isCleanString)
      .filter(s => !this.isTechnical(s))
      .sort((a, b) => b.length - a.length);

    if (candidates.length > 0) metadata.title = candidates[0];

    for (const s of strings) {
      const lower = s.toLowerCase();
      if (lower.includes('composed by') || lower.includes('arranged by') || lower.includes('by ')) {
        const composer = s.replace(/composed by|arranged by|by /gi, '').trim();
        if (composer.length > 2 && composer.length < 50) { metadata.composer = composer; break; }
      }
    }

    const copyrightStr = strings.find(s => s.toLowerCase().includes('copyright') || s.includes('©'));
    if (copyrightStr) metadata.copyright = copyrightStr;

    return metadata;
  }

  private isTechnical(s: string): boolean {
    const t = ['Sibelius','Windows','MacOS','Avid','Microsoft','Arial','Times New Roman','Verdana','Helvetica','TrueType','OpenType','DLL','EXE','tmp','temp','Program Files','Users/','C:\\','http://','https://','.dll','.exe','.tmp'];
    return t.some(p => s.toLowerCase().includes(p.toLowerCase()));
  }

  private attemptNoteExtraction(reader: BinaryReader, versionInfo: SibVersionInfo): Note[] {
    const notes: Note[] = [];
    reader.seek(versionInfo.headerSize);
    const allBytes = new Uint8Array(reader.buffer);

    // Scan for MIDI note patterns across wider ranges
    const midiRanges = [
      { min: 40, max: 90, label: 'melody' },
      { min: 21, max: 108, label: 'full range' },
    ];

    for (const range of midiRanges) {
      let seq: { pitch: number; pos: number }[] = [];
      const sequences: { pitch: number; pos: number }[][] = [];

      for (let i = 0; i < allBytes.length; i++) {
        const byte = allBytes[i];
        if (byte >= range.min && byte <= range.max) {
          const next = i + 1 < allBytes.length ? allBytes[i+1] : 0;
          if (next > 0 && next <= 128) seq.push({ pitch: byte, pos: i });
          else if (seq.length > 0) { if (seq.length >= 4) sequences.push([...seq]); seq = []; }
        } else if (seq.length > 0) { if (seq.length >= 4) sequences.push([...seq]); seq = []; }
      }
      if (seq.length >= 4) sequences.push(seq);

      if (sequences.length > 0) {
        const best = sequences.reduce((a, b) => a.length > b.length ? a : b);
        const steps: NoteStep[] = ['C','C','D','D','E','F','F','G','G','A','A','B'];
        const alters = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
        for (const nd of best) {
          const pc = nd.pitch % 12;
          const oct = Math.floor(nd.pitch / 12) - 1;
          notes.push({
            pitch: { step: steps[pc], alter: alters[pc], octave: oct },
            duration: 4, type: 'quarter', voice: '1',
          });
        }
        break; // Found notes in this range, stop scanning
      }
    }

    if (notes.length === 0) {
      this.warnings.push('Note data is deeply encoded in this .sib file. Only metadata could be extracted.');
    } else if (notes.length < 20) {
      this.warnings.push(`Found ${notes.length} note previews. Full score requires MusicXML export from Sibelius.`);
    }

    return notes;
  }

  private buildScore(notes: Note[], metadata: ScoreMetadata, versionInfo: SibVersionInfo): ScorePartwise {
    const beatsPerMeasure = 4;
    const beatDuration = 4;
    const measureDuration = beatsPerMeasure * beatDuration;

    const measures: Measure[] = [];
    let currentNotes: Note[] = [];
    let currentDuration = 0;
    let measureNumber = 1;

    for (const note of notes) {
      const dur = note.duration || 4;
      if (currentDuration + dur > measureDuration && currentNotes.length > 0) {
        measures.push({ number: measureNumber.toString(), notes: [...currentNotes], barlines: [{ location: 'right', style: 'regular' }] });
        measureNumber++;
        currentNotes = [note];
        currentDuration = dur;
      } else {
        currentNotes.push(note);
        currentDuration += dur;
      }
    }

    if (currentNotes.length > 0) {
      measures.push({ number: measureNumber.toString(), notes: currentNotes, barlines: [{ location: 'right', style: 'light-heavy' }] });
    }

    if (measures.length > 0) {
      measures[0].attributes = {
        divisions: 4,
        clef: { sign: 'G', line: 2 },
        key: { fifths: 0, mode: 'major' },
        time: { beats: 4, beatType: 4 },
      };
    }

    return {
      layout: 'partwise',
      metadata,
      parts: [{ id: 'P1', name: metadata.title || 'Sibelius Import', measures }],
    };
  }
}

export const sibeliusParser = new SibeliusParser();

export async function parseSibFile(file: File | ArrayBuffer): Promise<SibParseResult> {
  return sibeliusParser.parse(file);
}
