// ==========================================================================
// This Area Of Code Is: The Ideas Pipeline.
// Explanation: EVERYONE can compose and submit music literature ideas — a
// hook, a lyric, a whole song concept. Every idea routes to the Music
// Director's review inbox ("does this fit with the music?"). The director
// can pause submissions entirely and the app tells everyone: "No ideas at
// this time." On-device, like everything else.
// In Other Words: A suggestion box that only the director empties.
// ==========================================================================

export type IdeaStatus = 'pending' | 'fits' | 'notNow';

export interface Idea {
  id: string;
  author: string;
  title: string;
  body: string;             // the music literature itself
  status: IdeaStatus;
  note?: string;            // director's review note
  ts: number;
}

const IDEAS_KEY = 'ntcc.ideas.inbox';
const PAUSED_KEY = 'ntcc.ideas.paused';

const uid = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function ideasPaused(): boolean {
  return localStorage.getItem(PAUSED_KEY) === '1';
}
export function setIdeasPaused(paused: boolean): void {
  localStorage.setItem(PAUSED_KEY, paused ? '1' : '0');
}

export function loadIdeas(): Idea[] {
  try {
    const raw = localStorage.getItem(IDEAS_KEY);
    if (raw) return JSON.parse(raw) as Idea[];
  } catch { /* fall through */ }
  return [];
}

export function submitIdea(author: string, title: string, body: string): Idea[] {
  const list = [...loadIdeas(), {
    id: uid(), author, title: title.trim(), body: body.trim(),
    status: 'pending' as IdeaStatus, ts: Date.now(),
  }];
  localStorage.setItem(IDEAS_KEY, JSON.stringify(list));
  return list;
}

export function reviewIdea(id: string, status: IdeaStatus, note = ''): Idea[] {
  const list = loadIdeas().map((i) => (i.id === id ? { ...i, status, note } : i));
  localStorage.setItem(IDEAS_KEY, JSON.stringify(list));
  return list;
}

export function removeIdea(id: string): Idea[] {
  const list = loadIdeas().filter((i) => i.id !== id);
  localStorage.setItem(IDEAS_KEY, JSON.stringify(list));
  return list;
}
