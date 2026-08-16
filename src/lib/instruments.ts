// ==========================================================================
// This Area Of Code Is: The Instrumentation Engine.
// Explanation: Not every church has every instrument — and the sheet music
// was only transposed for the way it was RECORDED. So the director declares
// what THIS church has: any instruments in the world (with counts), the
// vocal types available (soprano/alto/tenor/baritone/bass, with counts),
// and who leads. From that, the app automatically advises the best key and
// arrangement posture for every song — a 5-person chapel and a 30-voice
// choir get different, correct answers.
// In Other Words: Tell the app who showed up; it tells you how to play it.
// ==========================================================================

export const VOICE_TYPES = ['Soprano', 'Alto', 'Tenor', 'Baritone', 'Bass'] as const;

// The instruments of the world, grouped — a capella is always available.
export const WORLD_INSTRUMENTS: Record<string, string[]> = {
  Keys: ['Piano', 'Organ', 'Keyboard', 'Synth', 'Accordion'],
  Strings: ['Acoustic Guitar', 'Electric Guitar', 'Bass Guitar', 'Violin', 'Viola', 'Cello', 'Double Bass', 'Harp', 'Mandolin', 'Ukulele'],
  Wind: ['Flute', 'Clarinet', 'Oboe', 'Bassoon', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Trumpet', 'Trombone', 'French Horn', 'Tuba', 'Harmonica'],
  Percussion: ['Drum Kit', 'Cajón', 'Congas', 'Bongos', 'Tambourine', 'Shakers', 'Timpani', 'Handbells'],
  Voice: ['A Cappella (voices only)'],
};

export interface InstrumentationProfile {
  instruments: Record<string, number>; // name → count
  voices: Record<string, number>;      // voice type → count
  leader: string;                      // who leads (name)
  leaderVoice: string;                 // their voice type
}

const KEY_I = 'ntcc.team.instrumentation';

export function loadInstrumentation(): InstrumentationProfile {
  try {
    const raw = localStorage.getItem(KEY_I);
    if (raw) return JSON.parse(raw) as InstrumentationProfile;
  } catch { /* fall through */ }
  return { instruments: {}, voices: {}, leader: '', leaderVoice: '' };
}

export function saveInstrumentation(p: InstrumentationProfile): void {
  localStorage.setItem(KEY_I, JSON.stringify(p));
}

export interface ArrangementAdvice {
  recommendedKeys: string[];   // best keys for THIS leader voice
  posture: string;             // arrangement guidance for THIS team size
  totalPlayers: number;
  totalSingers: number;
}

// Voice-comfort key zones (common worship practice):
const VOICE_KEYS: Record<string, string[]> = {
  Soprano: ['A', 'B♭', 'B', 'C', 'D'],
  Alto: ['E', 'F', 'G', 'A', 'B♭'],
  Tenor: ['C', 'D', 'E', 'F', 'G'],
  Baritone: ['A', 'B♭', 'B', 'C', 'D'],
  Bass: ['E', 'F', 'G', 'A', 'B♭'],
};

export function adviseArrangement(p: InstrumentationProfile): ArrangementAdvice {
  const totalPlayers = Object.values(p.instruments).reduce((a, b) => a + b, 0);
  const totalSingers = Object.values(p.voices).reduce((a, b) => a + b, 0);
  const aCappellaOnly = totalPlayers === 0 || (p.instruments['A Cappella (voices only)'] ?? 0) > 0;
  const recommendedKeys = VOICE_KEYS[p.leaderVoice] ?? ['C', 'D', 'E', 'F', 'G'];

  let posture: string;
  if (aCappellaOnly) {
    posture = totalSingers >= 20
      ? 'Full a cappella — 4-part harmony carries the room; pitch-pipe the recommended key.'
      : 'A cappella with a small team — double the melody in two parts for strength.';
  } else if (totalPlayers <= 3 && totalSingers <= 5) {
    posture = 'Small band, small team — keep the arrangement sparse; keys carry chords, one harmony part.';
  } else if (totalSingers >= 20) {
    posture = 'Full band, full choir — rich 4-part harmony with the band underneath; consider a key-lift on the last chorus.';
  } else {
    posture = 'Balanced team — standard worship arrangement works; harmonies on choruses.';
  }
  if (p.leader) posture += ` Led by ${p.leader}${p.leaderVoice ? ` (${p.leaderVoice})` : ''}.`;

  return { recommendedKeys, posture, totalPlayers, totalSingers };
}
