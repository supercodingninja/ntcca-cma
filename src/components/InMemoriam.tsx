// ==========================================================================
// This Area Of Code Is: The In Memoriam page (Viewer start, spec 7.c.i).
// Explanation: Every Viewer session begins here, honoring our brother
// before the music. A moment of reverence, then one touch enters the app.
// In Other Words: We remember John first. Always.
// ==========================================================================

export default function InMemoriam({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card p-10 max-w-lg text-center">
        <p className="text-muted tracking-[0.3em] text-sm mb-6">IN MEMORIAM</p>
        <h1 className="font-display text-3xl text-accent mb-1">JOHN ORKIN SMITH</h1>
        <p className="text-lg mt-2">DEC 17, 1969 ~ NOV 8, 2022</p>
        <p className="text-muted mt-3">REST IN PEACE OUR BROTHER BELOVED…</p>
        <blockquote className="mt-6 text-lg italic leading-relaxed">
          "PRECIOUS IN THE SIGHT OF THE LORD IS THE DEATH OF HIS SAINTS."
          <footer className="text-accent text-sm mt-2 not-italic">PSALM 116:15</footer>
        </blockquote>
        <button className="cta-gold px-10 py-3 mt-8" onClick={onEnter}>Enter</button>
      </div>
    </div>
  );
}
