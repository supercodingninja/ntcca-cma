// ==========================================================================
// This Area Of Code Is: The trademark-blue Accessibility orb.
// Explanation: The GetWell signature, done to our standard — the classic
// blue rounded-square wheelchair symbol (the trademark blue the world
// knows), with ACCESSIBILITY curved above it and OPTIONS below, all
// wrapped in a thin glass ring. Used anywhere the app offers the
// Universal Access door.
// In Other Words: One look, and every saint knows — this is where the
// app becomes theirs.
// ==========================================================================

export default function AccessOrb({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="ao-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3d8bfd" />
          <stop offset="1" stopColor="#0b4fc4" />
        </linearGradient>
        <path id="ao-top" d="M 17,62 A 43,43 0 0 1 103,62" fill="none" />
        <path id="ao-bot" d="M 14,60 A 46,46 0 0 0 106,60" fill="none" />
      </defs>

      {/* Glass ring */}
      <circle cx="60" cy="60" r="57" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4" />

      {/* Curved words */}
      <text fontSize="14.5" fontWeight="800" letterSpacing="2.6" fill="#ffffff"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>
        <textPath href="#ao-top" startOffset="50%" textAnchor="middle">ACCESSIBILITY</textPath>
      </text>
      <text fontSize="12.5" fontWeight="700" letterSpacing="4.6" fill="rgba(255,255,255,0.92)">
        <textPath href="#ao-bot" startOffset="50%" textAnchor="middle">OPTIONS</textPath>
      </text>

      {/* Trademark blue badge */}
      <rect x="40" y="44" width="40" height="36" rx="9" fill="url(#ao-blue)"
            stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />
      {/* Wheelchair symbol (white) */}
      <circle cx="61" cy="52" r="3" fill="#ffffff" />
      <path d="M61 56.5 v7.5 h6.5 l3.6 7.5" fill="none" stroke="#ffffff" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round" />
      <path d="M61 59.5 h5.5" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="57.5" cy="68" r="6.4" fill="none" stroke="#ffffff" strokeWidth="2.4" />
    </svg>
  );
}
