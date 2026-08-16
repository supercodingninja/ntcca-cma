// ==========================================================================
// This Area Of Code Is: The Mic Helper — one hardened path for every mic
// feature in the app (tuner, Listen, SPL meter, rehearsal room, ingest).
// Explanation: Phones — iOS Safari especially — fail mic capture in three
// sneaky ways: (1) strict constraints like echoCancellation:false throw an
// OverconstrainedError even though a plain mic request would work; (2) a
// freshly created AudioContext starts in the "suspended" state and must be
// resume()d before any sound flows; (3) navigator.mediaDevices is undefined
// on non-secure pages. This helper walks down a ladder of constraint sets
// from "ideal" to "bare mic", always resumes the context, and reports a
// plain-language reason when the mic truly cannot open.
// In Other Words: Whatever phone walks in the door, the mic turns on — and
// if it really can't, the app says exactly why instead of silently dying.
// ==========================================================================

export type MicErrorReason = 'insecure' | 'unsupported' | 'denied' | 'busy' | 'unknown';

export class MicError extends Error {
  reason: MicErrorReason;
  constructor(reason: MicErrorReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

/** Human-readable guidance the UI can show verbatim. */
export function micErrorMessage(e: unknown): string {
  if (e instanceof MicError) {
    switch (e.reason) {
      case 'insecure':
        return 'The mic only works on a secure (https) page — open the app from its real address, not a preview link.';
      case 'unsupported':
        return 'This browser does not support microphone capture — try Safari or Chrome.';
      case 'denied':
        return 'Microphone blocked — tap the address-bar icon (aA / lock) and allow the microphone, then try again.';
      case 'busy':
        return 'The microphone is busy in another app — close other apps using the mic and try again.';
      default:
        return 'The microphone could not start — please try again.';
    }
  }
  return 'The microphone could not start — please try again.';
}

function classify(err: unknown): MicError {
  const name = (err as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return new MicError('denied', String(err));
  if (name === 'NotFoundError' || name === 'NotReadableError' || name === 'AbortError')
    return new MicError('busy', String(err));
  return new MicError('unknown', String(err));
}

/**
 * Open the mic with a graceful constraint ladder: try the caller's ideal
 * constraints first, then plain `{ audio: true }`, then bare `true`.
 * Throws MicError with a plain-language reason when nothing works.
 */
export async function getMicStream(ideal?: MediaTrackConstraints): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    // mediaDevices only exists on secure contexts — distinguish for the user.
    const insecure = typeof window !== 'undefined' && !window.isSecureContext;
    throw new MicError(insecure ? 'insecure' : 'unsupported', 'getUserMedia unavailable');
  }
  const attempts: (boolean | MediaStreamConstraints)[] = [];
  if (ideal) attempts.push({ audio: ideal });
  attempts.push({ audio: true });
  attempts.push({ video: false, audio: true });
  let lastErr: unknown = null;
  for (const c of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(c as MediaStreamConstraints);
    } catch (e) {
      lastErr = e;
      // Permission denied won't change by loosening constraints — stop early.
      if (e instanceof MicError || (e as { name?: string })?.name === 'NotAllowedError') throw classify(e);
    }
  }
  throw classify(lastErr);
}

/**
 * Create (or adopt) an AudioContext and make sure it is actually RUNNING —
 * iOS starts new contexts suspended; without resume() no samples ever flow.
 */
export async function runningAudioContext(existing?: AudioContext | null): Promise<AudioContext> {
  const ctx = existing ?? new AudioContext();
  if (ctx.state !== 'running') {
    try { await ctx.resume(); } catch { /* still starting — tick loop retries */ }
  }
  return ctx;
}
