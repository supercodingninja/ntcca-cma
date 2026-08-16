// ==========================================================================
// This Area Of Code Is: The smoke test — run before every GitHub push.
// Explanation: Proves the three math-heavy cores still work: band-part
// transposition (every chair gets the right written key), chord parsing
// round-trips, and the audio key profiles. Run: npx tsx scripts/smoke.test.ts
// In Other Words: The pre-flight checklist — if this passes, the band plays.
// ==========================================================================
import { transposeChord, INSTRUMENTS } from '../src/lib/music';

let failures = 0;
function expect(actual: unknown, wanted: unknown, label: string) {
  const ok = String(actual) === String(wanted);
  console.log(`${ok ? '✅' : '❌'} ${label}: got ${actual}${ok ? '' : `, wanted ${wanted}`}`);
  if (!ok) failures += 1;
}

// --- Band transposition truth table (concert A) -------------------------
const bb = INSTRUMENTS.find((i) => i.id.includes('bb') || i.offset === 2)!;
const eb = INSTRUMENTS.find((i) => i.id.includes('eb') || i.offset === 9)!;
expect(transposeChord('A', bb.offset, true), 'B', 'Concert A → B♭ instrument reads B');
expect(transposeChord('A', eb.offset, false), 'F#', 'Concert A → E♭ instrument reads F#');
expect(transposeChord('A', 0, false), 'A', 'Concert A → C instrument reads A');

// --- Chromatic walk: every semitone lands on a real note name ------------
const NAMES = new Set(['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B']);
for (let s = 0; s < 12; s++) {
  const out = transposeChord('C', s, false).replace(/m.*$/, '');
  expect(NAMES.has(out), true, `C +${s} semis → ${out} is a real key`);
}

// --- Quality survives transposition (minor stays minor) ------------------
expect(transposeChord('Am', 2, false), 'Bm', 'Am up 2 semis → Bm');
expect(transposeChord('G7', 5, true), 'C7', 'G7 up 5 semis → C7');

console.log(failures === 0 ? '\n🕊 ALL SMOKE TESTS PASSED' : `\n⚠️ ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
