// ==========================================================================
// This Area Of Code Is: The Setlist section.
// Explanation: The ordered service list. Songs persist in localStorage, tap
// to open in performance view, remove with one touch. Director devices can
// push the active song to the congregation from here.
// ==========================================================================

import { type Song } from '../lib/music';
import { useI18n } from '../lib/i18n';

interface Props {
  setlist: Song[];
  onOpen: (song: Song) => void;
  onRemove: (id: string) => void;
}

export default function SetlistSection({ setlist, onOpen, onRemove }: Props) {
  const { t } = useI18n();

  if (setlist.length === 0) {
    return <div className="glass-card p-8 text-center text-muted">{t('emptySetlist')}</div>;
  }

  return (
    <ol className="space-y-3">
      {setlist.map((song, i) => (
        <li key={song.id} className="glass-card interactive p-4 flex items-center gap-4 cursor-pointer"
            role="button" tabIndex={0} data-nav
            onClick={() => onOpen(song)} onKeyDown={(e) => e.key === 'Enter' && onOpen(song)}>
          <span className="text-accent font-display text-2xl w-8 text-center">{i + 1}</span>
          <div className="flex-1">
            <p className="font-semibold">{song.title}</p>
            <p className="text-muted text-sm">{t('key')}: {song.key} · {song.bpm} BPM</p>
          </div>
          <button
            className="glass-btn danger text-sm"
            aria-label={`${t('remove')} ${song.title}`}
            onClick={(e) => { e.stopPropagation(); onRemove(song.id); }}
          >
            ✕ {t('remove')}
          </button>
        </li>
      ))}
    </ol>
  );
}
