// ==========================================================================
// This Area Of Code Is: The AI Trio — JP, Tanya, and Vickie.
// Explanation: Three on-device assistants (free forever, no API keys):
//  • JP — the tasking assistant. Wake phrase "JP, my guy", then just "JP".
//    Admins assign tasks to editors/admins; editors give ETAs; if the tasking
//    admin is unreachable for 2 hours, two other admins can approve.
//  • Tanya — the design assistant. Admins drag/resize/restyle elements with
//    z-index control; changes collect as a draft and become a "Changes To
//    Make" email to FrederickDThomasJr@gmail.com ONLY when the user says send.
//  • Vickie — the music scholar. Answers music questions from a built-in
//    knowledge base (notes, stanzas, terms, history) and routes admins to
//    the right assistant.
// In Other Words: Three helpers who live inside the app — one assigns work,
// one redecorates, one knows everything about music.
// ==========================================================================

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Role } from './auth';

// ----------------------------- JP -----------------------------------------

export interface Task {
  id: string;
  title: string;
  assignedTo: string;
  assignedBy: string;
  createdAt: number;
  eta?: string;
  status: 'open' | 'eta-given' | 'awaiting-approval' | 'approved' | 'done';
  approvals: string[]; // admin emails who approved (need 2 when unreachable)
  unreachableAt?: number;
}

export class JPEngine {
  private tasks: Task[] = [];
  private listeners: (() => void)[] = [];
  listening = false;

  constructor() {
    try { this.tasks = JSON.parse(localStorage.getItem('ntcc.tasks') ?? '[]') as Task[]; } catch { this.tasks = []; }
  }

  private save(): void {
    localStorage.setItem('ntcc.tasks', JSON.stringify(this.tasks));
    this.listeners.forEach((fn) => fn());
  }

  onChange(fn: () => void): void { this.listeners.push(fn); }
  getTasks(): Task[] { return this.tasks; }

  /** Parse a spoken or typed command: "JP, task Maria fix the alto chart" */
  command(text: string, byUser: string, role: Role): string {
    if (role !== 'admin') return 'JP: Only admins can assign tasks.';
    const t = text.replace(/^\s*jp(,?\s*my guy)?[,:]?\s*/i, '');
    const m = t.match(/task\s+(\S+)\s+(.+)/i);
    if (!m) return 'JP: Say "JP, task [name] [what to do]" and I\'ll assign it.';
    const task: Task = {
      id: crypto.randomUUID(), assignedTo: m[1], title: m[2],
      assignedBy: byUser, createdAt: Date.now(), status: 'open', approvals: [],
    };
    this.tasks.unshift(task);
    this.save();
    return `JP: Tasked ${m[1]} — "${m[2]}". I'll hold them to an ETA.`;
  }

  giveEta(taskId: string, eta: string): void {
    this.tasks = this.tasks.map((t) => t.id === taskId ? { ...t, eta, status: 'eta-given' } : t);
    this.save();
  }

  markUnreachable(taskId: string): void {
    this.tasks = this.tasks.map((t) =>
      t.id === taskId ? { ...t, status: 'awaiting-approval', unreachableAt: Date.now() } : t);
    this.save();
  }

  approve(taskId: string, adminEmail: string): string {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return 'JP: Task not found.';
    // The 2-hour rule: unreachable approval only after two hours have passed.
    if (task.unreachableAt && Date.now() - task.unreachableAt < 2 * 60 * 60 * 1000) {
      return 'JP: Two hours must pass before other admins can approve.';
    }
    if (!task.approvals.includes(adminEmail)) task.approvals.push(adminEmail);
    if (task.approvals.length >= 2) task.status = 'approved';
    this.save();
    return task.status === 'approved'
      ? 'JP: Approved by two admins. Change is live.'
      : `JP: Approval recorded (${task.approvals.length}/2).`;
  }

  complete(taskId: string): void {
    this.tasks = this.tasks.map((t) => t.id === taskId ? { ...t, status: 'done' } : t);
    this.save();
  }
}

// ----------------------------- Tanya --------------------------------------

export interface DesignChange {
  id: string;
  elementLabel: string;
  property: string;   // e.g. "x", "width", "zIndex", "accent"
  oldValue: string;
  newValue: string;
  byUser: string;
  ts: number;
  /** Original code context emailed per spec (best-effort label of file/line) */
  codeRef: string;
}

export class TanyaEngine {
  private draft: DesignChange[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    try { this.draft = JSON.parse(localStorage.getItem('ntcc.designDraft') ?? '[]') as DesignChange[]; } catch { this.draft = []; }
  }

  onChange(fn: () => void): void { this.listeners.push(fn); }
  getDraft(): DesignChange[] { return this.draft; }

  record(change: Omit<DesignChange, 'id' | 'ts'>): void {
    this.draft.push({ ...change, id: crypto.randomUUID(), ts: Date.now() });
    localStorage.setItem('ntcc.designDraft', JSON.stringify(this.draft));
    this.listeners.forEach((fn) => fn());
  }

  clear(): void {
    this.draft = [];
    localStorage.setItem('ntcc.designDraft', '[]');
    this.listeners.forEach((fn) => fn());
  }

  /** Compose the "Changes To Make" email — sent only when the user says send. */
  composeEmail(): string {
    const lines = this.draft.map((c, i) =>
      `${i + 1}. ${c.elementLabel} — ${c.property}: "${c.oldValue}" → "${c.newValue}"
   Code: ${c.codeRef}
   By: ${c.byUser} · ${new Date(c.ts).toLocaleString()}`);
    return [
      'Subject: Changes To Make', '',
      'Draft design changes from the NTCC Music App:', '',
      ...lines, '',
      '— Tanya (on-device design assistant)',
    ].join('\n');
  }

  describe(): string {
    return 'I\'m Tanya. I help admins restyle this app without code — drag things, resize them, stack them with z-index, then I draft every change into a "Changes To Make" email. I never send it until you say "send email".';
  }
}

// ----------------------------- Vickie -------------------------------------

const KNOWLEDGE: { match: RegExp; answer: string }[] = [
  { match: /whole note/i, answer: 'A whole note lasts 4 beats in 4/4 — an open oval with no stem. Count: 1-2-3-4.' },
  { match: /half note/i, answer: 'A half note lasts 2 beats — open oval with a stem. Two per whole note.' },
  { match: /quarter note/i, answer: 'A quarter note lasts 1 beat — filled oval with a stem. The heartbeat of most worship songs.' },
  { match: /eighth note/i, answer: 'An eighth note lasts half a beat — filled oval with one flag or beam. Count: "1-and-2-and".' },
  { match: /stanza|verse/i, answer: 'A stanza (verse) is a grouped set of lyric lines. In hymns, each stanza sings the same melody with new words. Note count: read measure by measure, left to right — each measure must total the time signature.' },
  { match: /time signature|4\/4|3\/4|6\/8/i, answer: 'The time signature is the two numbers at the start: top = beats per measure, bottom = which note gets one beat. 4/4 = four quarter beats; 6/8 = six eighth beats, felt in two.' },
  { match: /sharp|flat|key signature/i, answer: 'The key signature\'s sharps/flats apply to every matching note. Order of sharps: F C G D A E B. Order of flats: B E A D G C F — exact reverses.' },
  { match: /tempo|bpm/i, answer: 'Tempo is speed, measured in BPM (beats per minute). Worship ballads sit 60–76, praise songs 90–130. A metronome marking like ♩=72 means 72 quarter notes per minute.' },
  { match: /ccli/i, answer: 'CCLI (Christian Copyright Licensing International) lets churches legally reproduce song lyrics. Report usage monthly — this app exports that report to Excel for you.' },
  { match: /transpose/i, answer: 'Transposing moves every chord by the same interval. Up a whole step: A→B, C→D, G→A. Use the Transpose control in any chart — I handle the sharps and flats.' },
  { match: /capo/i, answer: 'A capo clamps the guitar neck to raise pitch while keeping easy chord shapes. Capo 2 with G shapes sounds in A. The app computes capo for you in the song view.' },
  { match: /who (are|is) (you|vickie)/i, answer: 'I\'m Vickie — I know this whole app and all things music. Ask me about notes, stanzas, terms, or which assistant to use: JP for tasking, Tanya for design.' },
  { match: /jp|tanya/i, answer: 'JP handles admin tasking (say "JP, my guy"). Tanya handles design changes for admins. I\'m Vickie — music knowledge and app guidance.' },
];

export function askVickie(question: string): string {
  for (const k of KNOWLEDGE) {
    if (k.match.test(question)) return k.answer;
  }
  return 'Vickie: I didn\'t catch that. Try asking about a note type, stanza, key signature, tempo, capo, transposing, or CCLI — or ask which assistant can help you.';
}

// ------------------------- Shared context ---------------------------------

interface AICtx {
  jp: JPEngine;
  tanya: TanyaEngine;
  aiOpen: 'jp' | 'tanya' | 'vickie' | null;
  setAiOpen: (v: 'jp' | 'tanya' | 'vickie' | null) => void;
}

const Ctx = createContext<AICtx | null>(null);
const jpEngine = new JPEngine();
const tanyaEngine = new TanyaEngine();

export function AIProvider({ children }: { children: ReactNode }) {
  const [aiOpen, setAiOpen] = useState<AICtx['aiOpen']>(null);
  return <Ctx.Provider value={{ jp: jpEngine, tanya: tanyaEngine, aiOpen, setAiOpen }}>{children}</Ctx.Provider>;
}

export function useAI(): AICtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAI outside provider');
  return v;
}
