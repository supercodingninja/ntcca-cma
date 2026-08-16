// ==========================================================================
// This Area Of Code Is: The Narration Engine — the app tells you what is on
// the page and what it just did.
// Explanation: Using the device's built-in speech (Web Speech API — free,
// offline, no service), the app reads page changes, song opens, and actions
// aloud. It honors the user's language choice, the reduced-motion/
// reduced-sensory preference, and can be toggled in the Access panel.
// In Other Words: The app speaks — "Library page, three songs" — so anyone
// who can't see the screen still knows exactly what's happening.
// ==========================================================================

let enabled = false;
let currentVoice: SpeechSynthesisVoice | null = null;

export function setNarration(on: boolean): void {
  enabled = on;
  localStorage.setItem('ntcc.narration', JSON.stringify(on));
  if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
}

export function narrationEnabled(): boolean {
  try {
    return JSON.parse(localStorage.getItem('ntcc.narration') ?? 'false') as boolean;
  } catch {
    return false;
  }
}

/** Pick the best voice for the app's current language. */
function pickVoice(lang: string): void {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  currentVoice =
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.startsWith(lang.split('-')[0])) ??
    voices.find((v) => v.lang.startsWith('en')) ??
    null;
}

/** Say it out loud — cancels anything mid-sentence so narration stays current. */
export function narrate(text: string, lang = 'en-US'): void {
  if (!enabled || !('speechSynthesis' in window)) return;
  if (!currentVoice) pickVoice(lang);
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (currentVoice) u.voice = currentVoice;
  u.lang = currentVoice?.lang ?? lang;
  u.rate = 1.05;
  speechSynthesis.speak(u);
}

// Voices load asynchronously in some browsers — warm the cache.
if ('speechSynthesis' in window) {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => pickVoice(document.documentElement.lang || 'en-US');
}
